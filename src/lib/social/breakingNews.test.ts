import { describe, expect, it } from "vitest";
import { breakingSlotFor, findBreaking } from "./breakingNews";

const now = new Date("2026-10-06T17:00:00Z");
const at = (id: string, title: string, source: string, minutesAgo: number) => ({ id, title, sourceName: source, publishedAt: new Date(now.getTime() - minutesAgo * 60_000) });

describe("findBreaking", () => {
  const ton = [
    at("a", "Shreyas Iyer slams maiden T20I century as India beat West Indies", "Hindustan Times", 20),
    at("b", "Shreyas Iyer maiden T20I century powers India past West Indies", "Times of India", 25),
    at("c", "India beat West Indies as Shreyas Iyer hits maiden T20I century", "Sportstar", 30),
    at("d", "Shreyas Iyer maiden T20I century India beat West Indies eight wickets", "India Today", 35),
    at("e", "Shreyas Iyer hits maiden T20I century in India win over West Indies", "CricketAddictor", 40),
  ];

  it("flags a fresh story that several outlets cover at once", () => {
    const found = findBreaking([...ton, at("z", "Kerala Ranji squad announced", "Mathrubhumi", 15)], now);
    expect(found.has("a")).toBe(true);
    expect(found.has("e")).toBe(true);
    expect(found.has("z")).toBe(false);
  });

  it("does not flag a story only one or two outlets have", () => {
    expect(findBreaking(ton.slice(0, 2), now).size).toBe(0);
  });

  it("counts different outlets, not repeated posts from one", () => {
    const sameOutlet = ton.map((t, i) => ({ ...t, id: "s" + i, sourceName: "Hindustan Times" }));
    expect(findBreaking(sameOutlet, now).size).toBe(0);
  });

  it("ignores stories that are over an hour old", () => {
    const old = ton.map((t) => ({ ...t, publishedAt: new Date(now.getTime() - 90 * 60_000) }));
    expect(findBreaking(old, now).size).toBe(0);
  });

  it("can be tuned with a lower outlet minimum", () => {
    expect(findBreaking(ton.slice(0, 2), now, 2).size).toBe(2);
  });
});

describe("breakingSlotFor", () => {
  it("is stable and splits stories close to half and half", () => {
    expect(breakingSlotFor("abc")).toBe(breakingSlotFor("abc"));
    const ids = Array.from({ length: 4000 }, (_, i) => `story${i}${(i * 104729).toString(36)}`);
    const zero = ids.filter((id) => breakingSlotFor(id) === 0).length;
    expect(zero / ids.length).toBeGreaterThan(0.45);
    expect(zero / ids.length).toBeLessThan(0.55);
  });
});

describe("default threshold", () => {
  it("flags a story three outlets cover, but not two", () => {
    const ton = [
      at("a", "Bhuvneshwar returns as India announces T20I squad for New Zealand series", "Hindustan Times", 20),
      at("b", "India announces T20I squad for New Zealand series, Bhuvneshwar returns", "Times of India", 25),
      at("c", "India T20I squad for New Zealand series: Bhuvneshwar recalled", "Sportstar", 30),
    ];
    expect(findBreaking(ton, now).size).toBeGreaterThan(0);
    expect(findBreaking(ton.slice(0, 2), now).size).toBe(0);
  });
});
