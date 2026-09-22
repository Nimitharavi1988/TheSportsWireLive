import { describe, it, expect } from "vitest";
import { detectEventSeries } from "./eventTagging";

describe("detectEventSeries", () => {
  it("tags a real cricket headline mentioning the Asian Games", () => {
    const result = detectEventSeries("Harmanpreet Kaur's bunch looks to make another Asian Games final");
    expect(result).toEqual({ key: "asian-games-2026", label: "Asian Games 2026" });
  });

  // The whole point of this detector vs. cricketSeries.ts's bilateral-only
  // one — it has to work for a sport that isn't cricket at all.
  it("tags a non-cricket headline the same way (cross-category by design)", () => {
    const result = detectEventSeries("Quimcy, who represented India in teqball at Asian Games, dreams big");
    expect(result).toEqual({ key: "asian-games-2026", label: "Asian Games 2026" });
  });

  it("returns null for a title with no recognized event", () => {
    expect(detectEventSeries("India vs Afghanistan, 1st T20I preview")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectEventSeries("asian games: India march into semi-final")).not.toBeNull();
  });

  it("tags an IPL headline (evergreen, no season year)", () => {
    expect(detectEventSeries("Chennai Super Kings appoint Zaheer Khan as their new head coach")).toBeNull();
    expect(detectEventSeries("Zaheer Khan appointed IPL side Chennai Super Kings' head coach")).toEqual({
      key: "ipl",
      label: "IPL",
    });
  });

  // Real false-positive risk: a naive substring match on "IPL" would also
  // match inside unrelated words.
  it("does not false-positive on words that merely contain the letters ipl", () => {
    expect(detectEventSeries("Multiple players face discipline after the incident")).toBeNull();
  });
});
