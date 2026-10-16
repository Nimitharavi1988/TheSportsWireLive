import { describe, it, expect } from "vitest";
import { reelFeatures } from "./decisionFeatures";

const base = { category: "wnba", title: "Caitlin Clark's 1s hit the NBA floor", publishedAt: new Date("2026-10-13T16:00:00Z"), trendingScore: 61, now: new Date("2026-10-13T19:30:00Z"), theme: "orange", music: "hype", captionVariant: "control", hook: "Clark's debut stats stun", factRows: 4 };

describe("reelFeatures", () => {
  it("records the sport, story age, hour and creative choices", () => {
    const f = reelFeatures(base);
    expect(f).toMatchObject({ sport: "wnba", ageH: 3.5, hourUtc: 19, theme: "orange", music: "hype", captionVariant: "control", hookWords: 4, factRows: 4, topic: "main", language: "en", star: false });
  });
  it("keeps only the sport part of a sub-category, flags star stories, and handles a missing date", () => {
    const f = reelFeatures({ ...base, category: "football/world-cup", title: "Messi scores again", publishedAt: null, topicKey: "es", language: "es" });
    expect(f).toMatchObject({ sport: "football", category: "football/world-cup", ageH: null, star: true, topic: "es", language: "es" });
  });
});
