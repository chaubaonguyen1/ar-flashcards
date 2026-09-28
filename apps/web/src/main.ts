import "./style.css";
import { BADGES, CARD_IDS, SPEED_WINDOW_MS, type Card, type CardId, type Deck, type SessionState } from "@flashcards/shared";
import { api } from "./api";
import type { ArScanner } from "./ar";

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const ui = {
  canvas: $<HTMLCanvasElement>("#ar-canvas"),
  start: $("#start"),
  name: $<HTMLInputElement>("#player-name"),
  startError: $("#start-error"),
  demoStart: $("#demo-start"),
  hud: $("#hud"),
  score: $("#score"),
  streak: $("#streak"),
  collection: $("#collection"),
  panel: $("#panel"),
  idle: $("#panel-idle"),
  quiz: $("#panel-quiz"),
  choices: $("#choices"),
  timerBar: $("#timer-bar"),
  wordPanel: $("#panel-word"),
  result: $("#result"),
  word: $("#word"),
  phonetic: $("#phonetic"),
  meaning: $("#meaning"),
  example: $("#example"),
  demoSwitch: $("#demo-switch"),
  leaderboard: $<HTMLDialogElement>("#leaderboard"),
  leaderboardList: $("#leaderboard-list"),
  toast: $("#toast"),
};

let deck: Deck | null = null;
let session: SessionState | null = null;
let scanner: ArScanner | null = null;
/** Card currently shown in the bottom panel. */
let current: Card | null = null;
let quizStartedAt = 0;

const cardById = (id: CardId) => deck!.cards.find((c) => c.id === id)!;
const demoCard = () => {
  const id = new URLSearchParams(location.search).get("demo");
  return CARD_IDS.find((c) => c === id);
};

// ---------- small helpers ----------

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

let toastTimer = 0;
function toast(text: string) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove("show"), 2400);
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function renderHud() {
  if (!session || !deck) return;
  ui.score.textContent = String(session.score);
  ui.streak.hidden = session.streak < 2;
  ui.streak.textContent = `🔥 ${session.streak} in a row`;
  ui.collection.replaceChildren(
    ...deck.cards.map((card) => {
      const li = document.createElement("li");
      const a = session!.answered[card.id];
      li.textContent = a ? card.word : "?";
      if (a) li.className = a.correct ? "correct" : "wrong";
      return li;
    }),
  );
}

function showPanel(which: "idle" | "quiz" | "word") {
  ui.idle.hidden = which !== "idle";
  ui.quiz.hidden = which !== "quiz";
  ui.wordPanel.hidden = which !== "word";
}

// ---------- card flow ----------

function showWord(card: Card, resultText = "", good = true) {
  ui.result.textContent = resultText;
  ui.result.className = `result ${good ? "good" : "bad"}`;
  ui.result.hidden = !resultText;
  ui.word.textContent = card.word;
  ui.phonetic.textContent = card.phonetic;
  ui.meaning.textContent = card.meaningVi;
  ui.example.textContent = `“${card.example}”`;
  showPanel("word");
  speak(card.word);
}

function showQuiz(card: Card) {
  quizStartedAt = performance.now();
  ui.timerBar.getAnimations().forEach((a) => a.cancel());
  ui.timerBar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
    duration: SPEED_WINDOW_MS,
    fill: "forwards",
  });
  ui.choices.replaceChildren(
    ...shuffle([card.word, ...card.distractors]).map((choice) => {
      const b = document.createElement("button");
      b.textContent = choice;
      b.addEventListener("click", () => void submit(card, choice, b));
      return b;
    }),
  );
  showPanel("quiz");
}

async function submit(card: Card, choice: string, button: HTMLButtonElement) {
  const buttons = [...ui.choices.querySelectorAll("button")];
  buttons.forEach((b) => (b.disabled = true));
  ui.timerBar.getAnimations().forEach((a) => a.pause());
  try {
    const result = await api.answer(session!.id, {
      cardId: card.id,
      choice,
      elapsedMs: Math.round(performance.now() - quizStartedAt),
    });
    button.classList.add(result.correct ? "correct" : "wrong");
    session!.answered[card.id] = { correct: result.correct, points: result.pointsAwarded };
    session!.score = result.totalScore;
    session!.streak = result.streak;
    session!.badges.push(...result.newBadges);
    renderHud();
    result.newBadges.forEach((id, i) => setTimeout(() => toast(`🏅 ${BADGES[id].label}`), 700 + i * 2500));

    setTimeout(() => {
      if (current !== card) return;
      showWord(card, result.correct ? `Correct! +${result.pointsAwarded} pts` : `It's “${card.word}”!`, result.correct);
    }, 600);
    if (result.deckCompleted) setTimeout(() => void showLeaderboard(), 4000);
  } catch (err) {
    buttons.forEach((b) => (b.disabled = false));
    toast(`Oops: ${(err as Error).message}`);
  }
}

function onCardFound(id: CardId) {
  if (!deck || current?.id === id) return;
  current = cardById(id);
  if (session?.answered[id]) showWord(current);
  else showQuiz(current);
}

// ---------- screens ----------

async function begin(demo?: CardId) {
  const name = ui.name.value.trim();
  if (!name) {
    ui.startError.hidden = false;
    ui.startError.textContent = "Enter your name first.";
    ui.name.focus();
    return;
  }
  try {
    deck ??= await api.deck();
    session = await api.startSession(name);
    localStorage.setItem("flashcards.player", name);
  } catch (err) {
    ui.startError.hidden = false;
    ui.startError.textContent = `Can't reach the server: ${(err as Error).message}`;
    return;
  }
  ui.start.hidden = true;
  ui.hud.hidden = false;
  ui.panel.hidden = false;
  showPanel("idle");
  renderHud();
  await runScanner(demo);
}

/** Lazy-loads the AR engine (ARToolKit WASM is ~1.6 MB) only once scanning starts. */
async function runScanner(demo?: CardId) {
  scanner?.stop();
  current = null;
  showPanel("idle");
  const { startScanner } = await import("./ar");
  scanner = startScanner(
    ui.canvas,
    {
      onFound: onCardFound,
      onLost: () => {}, // keep the last card on screen so kids can read it without holding the camera still
      onError: (message) => {
        ui.idle.querySelector(".hint")!.textContent = message;
      },
    },
    demo && `${import.meta.env.BASE_URL}demo/${demo}.jpg`,
  );

  ui.demoSwitch.hidden = !demo;
  if (demo) {
    ui.demoSwitch.replaceChildren(
      ...CARD_IDS.map((id, i) => {
        const b = document.createElement("button");
        b.textContent = `Card ${i + 1}`;
        b.classList.toggle("active", id === demo);
        b.addEventListener("click", () => {
          history.replaceState(null, "", `?demo=${id}`);
          void runScanner(id);
        });
        return b;
      }),
    );
  }
}

async function showLeaderboard() {
  ui.leaderboardList.replaceChildren();
  try {
    const rows = await api.leaderboard();
    for (const row of rows) {
      const li = document.createElement("li");
      li.textContent = `${row.playerName}: ${row.score} pts · ${row.words} word${row.words === 1 ? "" : "s"}`;
      if (row.playerName === session?.playerName) li.style.fontWeight = "700";
      ui.leaderboardList.append(li);
    }
    if (!rows.length) ui.leaderboardList.textContent = "No scores yet. Be the first!";
  } catch {
    ui.leaderboardList.textContent = "Leaderboard unavailable.";
  }
  ui.leaderboard.showModal();
}

// ---------- wiring ----------

ui.name.value = localStorage.getItem("flashcards.player") ?? "";
$("#btn-start").addEventListener("click", () => void begin(demoCard()));
ui.demoStart.replaceChildren(
  ...CARD_IDS.map((id, i) => {
    const b = document.createElement("button");
    b.textContent = `Card ${i + 1}`;
    b.addEventListener("click", () => {
      history.replaceState(null, "", `?demo=${id}`);
      void begin(id);
    });
    return b;
  }),
);
$("#btn-speak").addEventListener("click", () => current && speak(current.word));
$("#btn-leaderboard").addEventListener("click", () => void showLeaderboard());
$("#btn-exit").addEventListener("click", () => {
  scanner?.stop();
  location.href = location.pathname;
});
ui.leaderboard.querySelector("[data-close]")!.addEventListener("click", () => ui.leaderboard.close());
