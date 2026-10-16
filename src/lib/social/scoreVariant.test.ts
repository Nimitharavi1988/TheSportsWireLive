import { describe, it, expect } from "vitest";
import { photoScoreGroupFor } from "./scoreVariant";

describe("photoScoreGroupFor", () => {
  it("is stable for a story", () => {
    for (let i = 0; i < 50; i++) expect(photoScoreGroupFor(`s-${i}`)).toBe(photoScoreGroupFor(`s-${i}`));
  });
  it("splits stories about evenly between the score and the plain photo", () => {
    const strip = Array.from({ length: 2000 }, (_, i) => photoScoreGroupFor(`story-${i}`)).filter((g) => g === "strip").length;
    expect(strip / 2000).toBeGreaterThan(0.45);
    expect(strip / 2000).toBeLessThan(0.55);
  });
});
