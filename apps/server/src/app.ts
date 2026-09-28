import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import {
  StartSessionSchema,
  SubmitAnswerSchema,
  newBadges,
  pointsFor,
  type AnswerResult,
  type Deck,
} from "@flashcards/shared";
import type { SessionStore } from "./store";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApp({ deck, store }: { deck: Deck; store: SessionStore }) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "8kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/deck", (_req, res) => {
    res.json(deck);
  });

  app.post("/api/sessions", (req, res) => {
    const { playerName } = StartSessionSchema.parse(req.body);
    res.status(201).json(store.create(playerName));
  });

  // Points are computed here, not in the browser, so the leaderboard can't be
  // filled by posting a made-up score.
  app.post("/api/sessions/:id/answers", (req, res) => {
    const session = store.get(req.params.id);
    if (!session) throw new HttpError(404, "Session not found");
    const { cardId, choice, elapsedMs } = SubmitAnswerSchema.parse(req.body);
    const card = deck.cards.find((c) => c.id === cardId);
    if (!card) throw new HttpError(404, "Card not in this deck");
    if (session.answered[cardId]) throw new HttpError(409, "Card already answered");

    const correct = choice.trim().toLowerCase() === card.word.toLowerCase();
    const points = pointsFor(correct, elapsedMs, session.streak);
    session.answered[cardId] = { correct, points };
    session.score += points;
    session.streak = correct ? session.streak + 1 : 0;
    const earned = newBadges(session, { correct, elapsedMs }, deck.cards.length);
    session.badges.push(...earned);
    store.save(session);

    const result: AnswerResult = {
      correct,
      pointsAwarded: points,
      totalScore: session.score,
      streak: session.streak,
      newBadges: earned,
      deckCompleted: Object.keys(session.answered).length === deck.cards.length,
    };
    res.json(result);
  });

  app.get("/api/leaderboard", (_req, res) => {
    res.json(store.leaderboard(10));
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) res.status(400).json({ error: "Invalid request", issues: err.issues });
    else if (err instanceof HttpError) res.status(err.status).json({ error: err.message });
    else {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app;
}
