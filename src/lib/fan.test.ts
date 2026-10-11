import { describe, expect, it } from "vitest";
import { computeStreaks, earnedBadges, isBotUserAgent, nextTier, resolveVisitDay, tierFor } from "./fan";

describe("computeStreaks", () => {
  it("counts the run ending today", () => {
    expect(computeStreaks(["2026-10-09", "2026-10-10", "2026-10-11"], "2026-10-11")).toEqual({ current: 3, best: 3 });
  });
  it("keeps the streak alive until the visitor misses a full day", () => {
    expect(computeStreaks(["2026-10-09", "2026-10-10"], "2026-10-11").current).toBe(2);
    expect(computeStreaks(["2026-10-08", "2026-10-09"], "2026-10-11").current).toBe(0);
  });
  it("remembers the best run after a gap, ignores duplicates and junk", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-03", "bad", "2026-10-10", "2026-10-11"];
    expect(computeStreaks(days, "2026-10-11")).toEqual({ current: 2, best: 3 });
    expect(computeStreaks([], "2026-10-11")).toEqual({ current: 0, best: 0 });
  });
  it("handles a month boundary", () => {
    expect(computeStreaks(["2026-09-30", "2026-10-01"], "2026-10-01").current).toBe(2);
  });
});

describe("tiers and badges", () => {
  it("maps days to tiers and the next goal", () => {
    expect(tierFor(0)).toBeNull();
    expect(tierFor(1)?.id).toBe("rookie");
    expect(tierFor(7)?.id).toBe("regular");
    expect(tierFor(99)?.id).toBe("season-ticket");
    expect(tierFor(100)?.id).toBe("hall-of-famer");
    expect(nextTier(5)).toMatchObject({ daysToGo: 2, tier: { id: "regular" } });
    expect(nextTier(100)).toBeNull();
  });
  it("awards badges from stored facts only", () => {
    const ids = (f: Parameters<typeof earnedBadges>[0]) => earnedBadges(f).map((b) => b.id);
    expect(ids({ daysVisited: 0, bestStreak: 0, predictionsMade: 0, predictionsCorrect: 0 })).toEqual([]);
    expect(ids({ daysVisited: 8, bestStreak: 4, predictionsMade: 2, predictionsCorrect: 1 })).toEqual(["regular", "streak-3", "first-prediction"]);
    expect(ids({ daysVisited: 40, bestStreak: 31, predictionsMade: 9, predictionsCorrect: 5 })).toContain("sharp-eye");
  });
});

describe("visit day and bots", () => {
  const now = new Date("2026-10-11T23:30:00Z");
  it("accepts the client's local day within a day of UTC, else uses UTC", () => {
    expect(resolveVisitDay("2026-10-11", now)).toBe("2026-10-11");
    expect(resolveVisitDay("2026-10-12", now)).toBe("2026-10-12");
    expect(resolveVisitDay("2026-10-10", now)).toBe("2026-10-10");
    expect(resolveVisitDay("2026-09-01", now)).toBe("2026-10-11");
    expect(resolveVisitDay("nope", now)).toBe("2026-10-11");
    expect(resolveVisitDay(undefined, now)).toBe("2026-10-11");
  });
  it("flags crawlers and empty user agents", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS]")).toBe(false);
  });
});
