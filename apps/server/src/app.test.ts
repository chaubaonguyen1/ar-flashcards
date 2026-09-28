import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { DECK } from "./deck";
import { createSessionStore } from "./store";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp({ deck: DECK, store: createSessionStore() });
});

async function start(name = "Linh") {
  const res = await request(app).post("/api/sessions").send({ playerName: name });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

const answer = (id: string, body: object) => request(app).post(`/api/sessions/${id}/answers`).send(body);

describe("deck", () => {
  it("serves the six starter cards", async () => {
    const res = await request(app).get("/api/deck");
    expect(res.body.cards.map((c: { id: string }) => c.id)).toEqual(["apple", "tree", "house", "car", "fish", "sun"]);
  });
});

describe("answers", () => {
  it("scores a fast correct answer and awards badges", async () => {
    const id = await start();
    const res = await answer(id, { cardId: "apple", choice: "Apple", elapsedMs: 2_000 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correct: true, pointsAwarded: 140, streak: 1, deckCompleted: false });
    expect(res.body.newBadges).toEqual(["first-word", "quick-thinker"]);
  });

  it("is case-insensitive", async () => {
    const id = await start();
    expect((await answer(id, { cardId: "sun", choice: " sun ", elapsedMs: 20_000 })).body.correct).toBe(true);
  });

  it("gives 0 points and resets the streak on a wrong answer", async () => {
    const id = await start();
    await answer(id, { cardId: "apple", choice: "Apple", elapsedMs: 20_000 });
    const res = await answer(id, { cardId: "tree", choice: "Flower", elapsedMs: 1_000 });
    expect(res.body).toMatchObject({ correct: false, pointsAwarded: 0, streak: 0, totalScore: 100 });
  });

  it("allows one attempt per card", async () => {
    const id = await start();
    await answer(id, { cardId: "car", choice: "Bus", elapsedMs: 1_000 });
    expect((await answer(id, { cardId: "car", choice: "Car", elapsedMs: 1_000 })).status).toBe(409);
  });

  it("rejects unknown cards and bad payloads", async () => {
    const id = await start();
    expect((await answer(id, { cardId: "dragon", choice: "x", elapsedMs: 1 })).status).toBe(400);
    expect((await answer(id, { cardId: "apple" })).status).toBe(400);
    expect((await answer("nope", { cardId: "apple", choice: "Apple", elapsedMs: 1 })).status).toBe(404);
  });

  it("marks the deck complete after the last card", async () => {
    const id = await start();
    let last;
    for (const card of DECK.cards) last = await answer(id, { cardId: card.id, choice: card.word, elapsedMs: 20_000 });
    expect(last!.body.deckCompleted).toBe(true);
    expect(last!.body.newBadges).toEqual(expect.arrayContaining(["collector", "perfect"]));
  });
});

describe("leaderboard", () => {
  it("ranks by score and counts correct words", async () => {
    const a = await start("An");
    const b = await start("Binh");
    await answer(a, { cardId: "apple", choice: "Apple", elapsedMs: 20_000 });
    await answer(b, { cardId: "apple", choice: "Apple", elapsedMs: 1_000 });
    const res = await request(app).get("/api/leaderboard");
    expect(res.body).toEqual([
      { playerName: "Binh", score: 145, words: 1 },
      { playerName: "An", score: 100, words: 1 },
    ]);
  });
});
