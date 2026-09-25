import { describe, it, expect } from "vitest";
import { MAX_PER_CHANNEL, pickVideoStrip } from "./videoStrip";

const v = (channelTitle: string, hoursAgo: number, isHighlights = false) => ({
  channelTitle,
  isHighlights,
  publishedAt: new Date(Date.UTC(2026, 8, 25, 12) - hoursAgo * 3600_000),
});

describe("pickVideoStrip", () => {
  it("puts highlights first, then newest", () => {
    const rows = [v("NFL", 1), v("MLB", 5, true), v("NHL", 2, true)];
    expect(pickVideoStrip(rows, 10).map((r) => r.channelTitle)).toEqual(["NHL", "MLB", "NFL"]);
  });

  it("caps any one channel so a busy channel can't fill the strip", () => {
    const rows = [...Array.from({ length: 8 }, (_, i) => v("Sky Sports Football", i)), v("NBA", 20)];
    const picked = pickVideoStrip(rows, 10);
    expect(picked.filter((r) => r.channelTitle === "Sky Sports Football")).toHaveLength(MAX_PER_CHANNEL);
    expect(picked.map((r) => r.channelTitle)).toContain("NBA");
  });

  it("respects the limit", () => {
    const rows = ["A", "B", "C", "D"].map((c, i) => v(c, i));
    expect(pickVideoStrip(rows, 2)).toHaveLength(2);
  });
});
