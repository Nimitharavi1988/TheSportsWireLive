import { describe, it, expect } from "vitest";
import { pickOnward } from "./articleOnward";

const NOW = new Date("2026-09-26T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const photo = (id: string, h = 1): { id: string; heroImageUrl: string | null; publishedAt: Date } => ({ id, heroImageUrl: `https://cdn.example.com/photos/${id}.jpg`, publishedAt: hoursAgo(h) });
const noPhoto = (id: string, h = 1) => ({ id, heroImageUrl: null, publishedAt: hoursAgo(h) });
const stock = (id: string) => ({ id, heroImageUrl: `https://images.pexels.com/${id}.jpg`, publishedAt: hoursAgo(1) });

describe("pickOnward", () => {
  it("picks the first related story with a proper photo as Up next", () => {
    const r = pickOnward({ tagged: [noPhoto("t1"), photo("t2")], sameCategory: [photo("c1")], trending: [], justIn: [] }, NOW);
    expect(r.upNext?.id).toBe("t2");
    expect(r.upNextCandidates.map((a) => a.id)).toEqual(["t2", "c1"]);
    // Candidates are kept out of Related, so nothing shows twice.
    expect(r.related.map((a) => a.id)).toEqual(["t1"]);
    expect(r.relatedIsTagged).toBe(true);
  });

  it("falls back to a trending photo, then to the top related story", () => {
    expect(pickOnward({ tagged: [], sameCategory: [stock("c1")], trending: [photo("tr1")], justIn: [] }, NOW).upNext?.id).toBe("tr1");
    expect(pickOnward({ tagged: [], sameCategory: [noPhoto("c1")], trending: [noPhoto("tr1")], justIn: [] }, NOW).upNext?.id).toBe("c1");
    expect(pickOnward({ tagged: [], sameCategory: [], trending: [], justIn: [] }, NOW).upNext).toBeNull();
  });

  it("never promotes old news or a future-dated preview as Up next", () => {
    const old = photo("old", 11 * 24);
    const future = photo("future", -48);
    const r = pickOnward({ tagged: [old, future], sameCategory: [noPhoto("c1")], trending: [photo("fresh", 5)], justIn: [] }, NOW);
    expect(r.upNext?.id).toBe("fresh");
  });

  it("never repeats a story across the lists", () => {
    const r = pickOnward({
      tagged: [],
      sameCategory: [photo("a"), noPhoto("b"), noPhoto("c"), noPhoto("d")],
      trending: [photo("a"), noPhoto("b"), noPhoto("e"), noPhoto("f")],
      justIn: [noPhoto("e"), noPhoto("g")],
    }, NOW);
    const all = [r.upNext!, ...r.related, ...r.trendingNow, ...r.justIn].map((a) => a.id);
    expect(new Set(all).size).toBe(all.length);
    expect(r.related.map((a) => a.id)).toEqual(["b", "c", "d"]);
    expect(r.relatedIsTagged).toBe(false);
  });
});
