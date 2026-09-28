import { z } from "zod";

// ---------- Content ----------

export const CARD_IDS = ["apple", "tree", "house", "car", "fish", "sun"] as const;
export type CardId = (typeof CARD_IDS)[number];

export interface Card {
  id: CardId;
  word: string;
  phonetic: string;
  meaningVi: string;
  example: string;
  /** Wrong options shown next to the right word in the quiz. */
  distractors: [string, string];
}

export interface Deck {
  id: string;
  title: string;
  cards: Card[];
}

// ---------- API contracts ----------

export const StartSessionSchema = z.object({
  playerName: z.string().trim().min(1).max(32),
});

export const SubmitAnswerSchema = z.object({
  cardId: z.enum(CARD_IDS),
  choice: z.string().min(1).max(40),
  /** Milliseconds between the card being scanned and the answer. */
  elapsedMs: z.number().int().nonnegative(),
});
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerSchema>;

export interface SessionState {
  id: string;
  playerName: string;
  score: number;
  streak: number;
  /** One attempt per card: wrong answers still reveal the word, for 0 points. */
  answered: Partial<Record<CardId, { correct: boolean; points: number }>>;
  badges: BadgeId[];
  startedAt: number;
}

export interface AnswerResult {
  correct: boolean;
  pointsAwarded: number;
  totalScore: number;
  streak: number;
  newBadges: BadgeId[];
  deckCompleted: boolean;
}

export interface LeaderboardEntry {
  playerName: string;
  score: number;
  words: number;
}

// ---------- Scoring ----------

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
/** Answers inside this window get a speed bonus that shrinks to 0. */
export const SPEED_WINDOW_MS = 10_000;

/** Streak bonus: x1, x1.25, x1.5 ... capped at x2. */
export function streakMultiplier(streakBefore: number): number {
  return Math.min(1 + streakBefore * 0.25, 2);
}

export function speedBonus(elapsedMs: number): number {
  if (elapsedMs >= SPEED_WINDOW_MS) return 0;
  return Math.round(MAX_SPEED_BONUS * (1 - elapsedMs / SPEED_WINDOW_MS));
}

export function pointsFor(correct: boolean, elapsedMs: number, streakBefore: number): number {
  if (!correct) return 0;
  return Math.round((BASE_POINTS + speedBonus(elapsedMs)) * streakMultiplier(streakBefore));
}

// ---------- Badges ----------

export type BadgeId = "first-word" | "hot-streak" | "quick-thinker" | "collector" | "perfect";

export const BADGES: Record<BadgeId, { label: string; description: string }> = {
  "first-word": { label: "First Word", description: "Get your first word right" },
  "hot-streak": { label: "Hot Streak", description: "3 right answers in a row" },
  "quick-thinker": { label: "Quick Thinker", description: "Answer right within 3 seconds" },
  collector: { label: "Collector", description: "Scan every card in the deck" },
  perfect: { label: "Perfect Deck", description: "Every card right on the first try" },
};

/** Badges earned by the answer that was just applied to `session`. */
export function newBadges(
  session: SessionState,
  last: { correct: boolean; elapsedMs: number },
  deckSize: number,
): BadgeId[] {
  const answers = Object.values(session.answered);
  const done = answers.length === deckSize;
  const checks: Array<[BadgeId, boolean]> = [
    ["first-word", answers.some((a) => a.correct)],
    ["hot-streak", session.streak >= 3],
    ["quick-thinker", last.correct && last.elapsedMs <= 3_000],
    ["collector", done],
    ["perfect", done && answers.every((a) => a.correct)],
  ];
  return checks.filter(([id, ok]) => ok && !session.badges.includes(id)).map(([id]) => id);
}
