import { describe, expect, it } from "vitest";
import { newBadges, pointsFor, speedBonus, streakMultiplier, type SessionState } from "./index";

describe("scoring", () => {
  it("gives nothing for a wrong answer", () => {
    expect(pointsFor(false, 0, 4)).toBe(0);
  });

  it("shrinks the speed bonus over the window", () => {
    expect(speedBonus(0)).toBe(50);
    expect(speedBonus(5_000)).toBe(25);
    expect(speedBonus(30_000)).toBe(0);
  });

  it("caps the streak multiplier at x2", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(2)).toBe(1.5);
    expect(streakMultiplier(9)).toBe(2);
  });

  it("combines speed bonus and streak", () => {
    expect(pointsFor(true, 5_000, 2)).toBe(Math.round(125 * 1.5));
  });
});

describe("badges", () => {
  const session = (patch: Partial<SessionState>): SessionState => ({
    id: "s",
    playerName: "p",
    score: 0,
    streak: 0,
    answered: {},
    badges: [],
    startedAt: 0,
    ...patch,
  });

  it("awards first-word and quick-thinker on a fast first answer", () => {
    const s = session({ streak: 1, answered: { apple: { correct: true, points: 145 } } });
    expect(newBadges(s, { correct: true, elapsedMs: 2_000 }, 6)).toEqual(["first-word", "quick-thinker"]);
  });

  it("never awards a badge twice", () => {
    const s = session({ streak: 1, badges: ["first-word"], answered: { apple: { correct: true, points: 100 } } });
    expect(newBadges(s, { correct: true, elapsedMs: 8_000 }, 6)).toEqual([]);
  });

  it("gives collector but not perfect when one card was wrong", () => {
    const s = session({
      badges: ["first-word"],
      answered: { apple: { correct: true, points: 100 }, tree: { correct: false, points: 0 } },
    });
    expect(newBadges(s, { correct: false, elapsedMs: 8_000 }, 2)).toEqual(["collector"]);
  });

  it("gives perfect when every card is right", () => {
    const s = session({
      streak: 2,
      badges: ["first-word"],
      answered: { apple: { correct: true, points: 100 }, tree: { correct: true, points: 100 } },
    });
    expect(newBadges(s, { correct: true, elapsedMs: 8_000 }, 2)).toEqual(["collector", "perfect"]);
  });
});
