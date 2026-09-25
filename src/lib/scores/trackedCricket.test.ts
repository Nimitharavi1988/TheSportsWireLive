import { describe, it, expect } from "vitest";
import { budgetAllows, isTrackedMatchDay, matchDurationMs, trackedInPlay, withHits, TRACKED_CRICKET_MATCHES } from "./trackedCricket";

const at = (iso: string) => new Date(iso);

describe("tracked match windows (India v West Indies, real CricketData times)", () => {
  it("picks the 1st ODI from 30 min before the start until it can have ended", () => {
    expect(trackedInPlay(at("2026-09-27T07:55:00Z"))).toHaveLength(0);
    expect(trackedInPlay(at("2026-09-27T08:05:00Z")).map((m) => m.name)).toEqual([TRACKED_CRICKET_MATCHES[0].name]);
    expect(trackedInPlay(at("2026-09-27T17:00:00Z"))).toHaveLength(1);
    expect(trackedInPlay(at("2026-09-27T17:45:00Z"))).toHaveLength(0);
  });

  it("uses the name for the format, since CricketData tags T20Is as odi", () => {
    expect(matchDurationMs("India vs West Indies, 1st T20I, West Indies tour of India, 2026")).toBe(4.5 * 3600_000);
    expect(matchDurationMs("India vs West Indies, 1st ODI, West Indies tour of India, 2026")).toBe(9 * 3600_000);
    expect(matchDurationMs("England vs India, 2nd Test")).toBe(5 * 24 * 3600_000);
  });

  it("slows the general feed only around a tracked match", () => {
    expect(isTrackedMatchDay(at("2026-09-27T06:45:00Z"))).toBe(true);
    expect(isTrackedMatchDay(at("2026-09-28T12:00:00Z"))).toBe(false);
  });
});

describe("call budget", () => {
  const now = at("2026-09-27T10:00:00Z");

  it("allows calls on a new day or below the safety limit", () => {
    expect(budgetAllows({}, now)).toBe(true);
    expect(budgetAllows({ hitsToday: 99, hitsDate: "2026-09-26" }, now)).toBe(true);
    expect(budgetAllows({ hitsToday: 60, hitsDate: "2026-09-27" }, now)).toBe(true);
  });

  it("stops at the safety limit for today", () => {
    expect(budgetAllows({ hitsToday: 95, hitsDate: "2026-09-27" }, now)).toBe(false);
  });

  it("records CricketData's own hit count without dropping other config", () => {
    expect(withHits({ other: 1 }, { hitsToday: 40 }, now)).toEqual({ other: 1, hitsToday: 40, hitsDate: "2026-09-27" });
    expect(withHits({ other: 1 }, undefined, now)).toEqual({ other: 1 });
  });
});
