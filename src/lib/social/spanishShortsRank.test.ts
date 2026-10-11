import { describe, it, expect } from "vitest";
import { spanishShortScore, isUsWakingHours, US_SPORTS_BOOST } from "./spanishShortsRank";

const day = new Date("2026-10-11T18:00:00Z"); // 14:00 Eastern
const night = new Date("2026-10-11T08:00:00Z"); // 04:00 Eastern
const story = (over: Partial<Parameters<typeof spanishShortScore>[0]> = {}) => ({ title: "Some story", category: "football", trendingScore: 50, publishedAt: new Date(day.getTime() - 3_600_000), ...over });

describe("isUsWakingHours", () => {
  it("is true from 8:00 Eastern and false overnight", () => {
    expect(isUsWakingHours(day)).toBe(true);
    expect(isUsWakingHours(night)).toBe(false);
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
