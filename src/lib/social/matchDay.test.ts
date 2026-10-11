import { describe, expect, it } from "vitest";
import { matchDayMultiplier, BOTH_SIDES_MULTIPLIER, ONE_SIDE_MULTIPLIER, type Fixture } from "./matchDay";

const now = new Date("2026-10-11T10:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * 3_600_000);
const fx = (home: string, away: string, h: number): Fixture => ({ home, away, kickoff: at(h) });

describe("matchDayMultiplier", () => {
  it("boosts a story naming both sides of a fixture in the window", () => {
    expect(matchDayMultiplier("India and West Indies Level at 1-1 Ahead of Third T20I in Indore", [fx("India", "West Indies", 3)], now)).toBe(BOTH_SIDES_MULTIPLIER);
    expect(matchDayMultiplier("Arsenal face an awkward puzzle against Leeds United", [fx("Arsenal FC", "Leeds United FC", 5)], now)).toBe(BOTH_SIDES_MULTIPLIER);
  });
  it("boosts one side only when the match is about to start or has just started", () => {
    expect(matchDayMultiplier("Arsenal injury latest ahead of the weekend", [fx("Arsenal FC", "Leeds United FC", 2)], now)).toBe(ONE_SIDE_MULTIPLIER);
    expect(matchDayMultiplier("Arsenal injury latest ahead of the weekend", [fx("Arsenal FC", "Leeds United FC", 9)], now)).toBe(1);
    // not match coverage: no boost for one side
    expect(matchDayMultiplier("Ryan Reaves retires from the NHL", [fx("Vegas Golden Knights", "Ryan Reaves", 2).home ? fx("Ryan Reaves", "Calgary Flames", 2) : fx("a", "b", 2)], now)).toBe(1);
  });
  it("ignores fixtures outside the window and unrelated stories", () => {
    expect(matchDayMultiplier("India beat West Indies", [fx("India", "West Indies", 30)], now)).toBe(1);
    expect(matchDayMultiplier("India beat West Indies", [fx("India", "West Indies", -9)], now)).toBe(1);
    expect(matchDayMultiplier("Messi says goodbye", [fx("India", "West Indies", 1)], now)).toBe(1);
    expect(matchDayMultiplier("anything", [], now)).toBe(1);
  });
  it("counts a match that ended within the last hours", () => {
    expect(matchDayMultiplier("Hope's century lifts West Indies past India", [fx("India", "West Indies", -4)], now)).toBe(BOTH_SIDES_MULTIPLIER);
  });
});

describe("abbreviated cricket headlines", () => {
  it("expands IND vs WI before matching", () => {
    expect(matchDayMultiplier("Varun Aaron on bowling ahead of IND vs WI 2026 3rd T20I", [fx("India", "West Indies", 3)], now)).toBe(BOTH_SIDES_MULTIPLIER);
  });
});
