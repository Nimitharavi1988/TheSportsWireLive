import { describe, it, expect } from "vitest";
import { openingFor, motionProgress, motionExpr, OPENING_TIMING } from "./reelOpening";

describe("openingFor", () => {
  it("is stable for a story and splits stories about evenly", () => {
    for (let i = 0; i < 40; i++) expect(openingFor(`s-${i}`)).toBe(openingFor(`s-${i}`));
    const fast = Array.from({ length: 2000 }, (_, i) => openingFor(`story-${i}`)).filter((o) => o === "fast").length;
    expect(fast / 2000).toBeGreaterThan(0.45);
    expect(fast / 2000).toBeLessThan(0.55);
  });
});

describe("motion at the start of a 12-second reel", () => {
  const ZOOM = 0.18;
  const zoomAt = (o: "fast" | "classic", seconds: number) => ZOOM * motionProgress(o, seconds / 12);
  it("the classic opening is almost still for the first 2 seconds (the delay noticed in the reel)", () => {
    expect(zoomAt("classic", 1)).toBeLessThan(0.005);
    expect(zoomAt("classic", 2)).toBeLessThan(0.015);
  });
  it("the fast opening is clearly moving by 1 second and by 2 seconds", () => {
    expect(zoomAt("fast", 1)).toBeGreaterThan(0.03);
    expect(zoomAt("fast", 2)).toBeGreaterThan(0.06);
  });
  it("both start at 0 and end at the full movement", () => {
    for (const o of ["fast", "classic"] as const) { expect(motionProgress(o, 0)).toBeCloseTo(0, 6); expect(motionProgress(o, 1)).toBeCloseTo(1, 6); }
  });
});

describe("motionExpr and timing", () => {
  it("keeps the classic expression exactly as it was", () => {
    expect(motionExpr("classic", 354)).toBe("((1-cos(PI*in/354))/2)");
  });
  it("escapes the comma of the fast expression for the filter graph", () => {
    expect(motionExpr("fast", 354)).toBe("(1-pow(1-in/354\\,3))");
  });
  it("brings the first fact in earlier in the fast opening", () => {
    expect(OPENING_TIMING.fast.hook).toBeLessThan(OPENING_TIMING.classic.hook);
  });
});
