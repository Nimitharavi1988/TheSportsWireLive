import { describe, it, expect } from "vitest";
import { spanishShortScore, isUsWakingHours, US_SPORTS_BOOST, shortFreshEnough } from "./spanishShortsRank";

const day = new Date("2026-10-11T18:00:00Z"); // 14:00 Eastern
const night = new Date("2026-10-11T08:00:00Z"); // 04:00 Eastern
const story = (over: Partial<Parameters<typeof spanishShortScore>[0]> = {}) => ({ title: "Some story", category: "football", trendingScore: 50, publishedAt: new Date(day.getTime() - 3_600_000), ...over });

describe("isUsWakingHours", () => {
  it("is true from 8:00 Eastern and false overnight", () => {
    expect(isUsWakingHours(day)).toBe(true);
    expect(isUsWakingHours(night)).toBe(false);
  });
});

describe("shortFreshEnough", () => {
  const now = new Date("2026-10-17T20:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  it("accepts a story inside the age limit and a Messi story at any age", () => {
    expect(shortFreshEnough({ title: "Some story", publishedAt: hoursAgo(3), createdAt: null }, [], now, 12)).toBe(true);
    expect(shortFreshEnough({ title: "Messi scores again", publishedAt: hoursAgo(40), createdAt: null }, [], now, 12)).toBe(true);
  });
  it("refuses an older story, but allows one up to a day old when it is about a match in the window", () => {
    const old = { title: "Seattle Seahawks lose to Denver Broncos in overtime", publishedAt: hoursAgo(18), createdAt: null };
    expect(shortFreshEnough(old, [], now, 12)).toBe(false);
    expect(shortFreshEnough(old, [{ home: "Seattle Seahawks", away: "Denver Broncos", kickoff: hoursAgo(5) }], now, 12)).toBe(true);
    expect(shortFreshEnough({ ...old, publishedAt: hoursAgo(30) }, [{ home: "Seattle Seahawks", away: "Denver Broncos", kickoff: hoursAgo(5) }], now, 12)).toBe(false);
  });
});

describe("spanishShortScore", () => {
  it("ranks a stronger, fresher story higher", () => {
    expect(spanishShortScore(story({ trendingScore: 80 }), [], day)).toBeGreaterThan(spanishShortScore(story({ trendingScore: 40 }), [], day));
    expect(spanishShortScore(story(), [], day)).toBeGreaterThan(spanishShortScore(story({ publishedAt: new Date(day.getTime() - 10 * 3_600_000) }), [], day));
  });
  it("boosts the US sports in US waking hours only", () => {
    const us = story({ category: "college-football" });
    expect(spanishShortScore(us, [], day) / spanishShortScore(story({ category: "football" }), [], day)).toBeCloseTo(US_SPORTS_BOOST, 5);
    expect(spanishShortScore(us, [], night) / spanishShortScore(story({ category: "football" }), [], night)).toBeCloseTo(1, 5);
  });
  it("puts Messi and Ronaldo stories first, even old and low-scoring", () => {
    const star = story({ title: "Messi vuelve a marcar", trendingScore: 5, publishedAt: new Date(day.getTime() - 30 * 3_600_000) });
    expect(spanishShortScore(star, [], day)).toBeGreaterThan(spanishShortScore(story({ trendingScore: 95 }), [], day));
  });
});
