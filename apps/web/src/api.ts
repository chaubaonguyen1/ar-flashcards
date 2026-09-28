import type { AnswerResult, Deck, LeaderboardEntry, SessionState, SubmitAnswerRequest } from "@flashcards/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText);
  return body as T;
}

export const api = {
  deck: () => call<Deck>("/deck"),
  startSession: (playerName: string) =>
    call<SessionState>("/sessions", { method: "POST", body: JSON.stringify({ playerName }) }),
  answer: (sessionId: string, body: SubmitAnswerRequest) =>
    call<AnswerResult>(`/sessions/${sessionId}/answers`, { method: "POST", body: JSON.stringify(body) }),
  leaderboard: () => call<LeaderboardEntry[]>("/leaderboard"),
};
