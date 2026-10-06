import { describe, it, expect } from "vitest";
import { bestSource, groundingProblem, minGroundingChars } from "./groundingRules";

const title = "Braves win Game 2 to even NLDS against Dodgers";
const real = "The Atlanta Braves beat the Los Angeles Dodgers 3-2 in Game 2 of the National League Division Series on Sunday night at Dodger Stadium, evening the series at one game each. Ray Kerr started a bullpen game for Atlanta and Michael Harris II tripled and doubled. ".repeat(3);

describe("minGroundingChars", () => {
  it("defaults, accepts a number, and 0 turns it off", () => {
    expect(minGroundingChars(undefined)).toBe(500);
    expect(minGroundingChars("")).toBe(500);
    expect(minGroundingChars("abc")).toBe(500);
    expect(minGroundingChars("-4")).toBe(500);
    expect(minGroundingChars("800")).toBe(800);
    expect(minGroundingChars("0")).toBe(0);
  });
});

describe("groundingProblem", () => {
  it("accepts long text about the headline", () => {
    expect(groundingProblem(title, real, 500)).toBeNull();
  });
  it("rejects an 83-character snippet", () => {
    expect(groundingProblem(title, "Full coverage from Yahoo Sports. Read the original report at the source link below.", 500)).toMatch(/too thin/);
  });
  it("rejects long text that is a navigation page, not the story", () => {
    const nav = "TRENDING NFL Power Rankings Rays top sloppy Yankees Week 5 Waiver Wire Falcons run over Saints White Sox up 2-0 in ALDS Recommended Stories About Our Ads ".repeat(6);
    expect(nav.length).toBeGreaterThan(500);
    expect(groundingProblem(title, nav, 500)).toMatch(/isn't about the headline/);
  });
  it("does not judge relevance for a very short headline", () => {
    expect(groundingProblem("Rice homers", "x".repeat(600), 500)).toBeNull();
  });
});

describe("bestSource", () => {
  it("takes the longest candidate that passes, so a good page beats a thin snippet", () => {
    const r = bestSource(title, ["Short snippet about the Braves.", real], 500);
    expect(r).toEqual({ text: real.trim() });
  });
  it("explains why nothing passed", () => {
    expect(bestSource(title, ["Short snippet."], 500)).toMatchObject({ problem: expect.stringMatching(/too thin/) });
    expect(bestSource(title, [], 500)).toEqual({ problem: "no source text" });
  });
});
