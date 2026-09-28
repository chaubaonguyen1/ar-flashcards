import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { LeaderboardEntry, SessionState } from "@flashcards/shared";

export interface SessionStore {
  create(playerName: string): SessionState;
  get(id: string): SessionState | undefined;
  save(session: SessionState): void;
  leaderboard(limit: number): LeaderboardEntry[];
}

/** In-memory sessions, optionally persisted to a JSON file so restarts keep the leaderboard. */
export function createSessionStore(filePath?: string): SessionStore {
  const sessions = new Map<string, SessionState>();
  if (filePath) {
    try {
      for (const s of JSON.parse(readFileSync(filePath, "utf8")) as SessionState[]) sessions.set(s.id, s);
    } catch {
      // first run: no file yet
    }
  }
  const persist = () => {
    if (!filePath) return;
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify([...sessions.values()], null, 2));
  };

  return {
    create(playerName) {
      const session: SessionState = {
        id: randomUUID(),
        playerName,
        score: 0,
        streak: 0,
        answered: {},
        badges: [],
        startedAt: Date.now(),
      };
      sessions.set(session.id, session);
      persist();
      return session;
    },
    get: (id) => sessions.get(id),
    save(session) {
      sessions.set(session.id, session);
      persist();
    },
    leaderboard(limit) {
      return [...sessions.values()]
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score || a.startedAt - b.startedAt)
        .slice(0, limit)
        .map((s) => ({
          playerName: s.playerName,
          score: s.score,
          words: Object.values(s.answered).filter((a) => a.correct).length,
        }));
    },
  };
}
