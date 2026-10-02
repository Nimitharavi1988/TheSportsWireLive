import { describe, it, expect } from "vitest";
import { parseReview } from "./review";

describe("parseReview", () => {
  it("accepts the three verdicts and keeps issues", () => {
    expect(parseReview({ verdict: "ok", issues: [] })).toEqual({ verdict: "ok", issues: [] });
    expect(parseReview({ verdict: "minor", issues: [" a "] })).toEqual({ verdict: "minor", issues: ["a"] });
    expect(parseReview({ verdict: "major", issues: ["wrong score"] }).verdict).toBe("major");
  });
  it("treats missing or malformed reviews as major so nothing slips through", () => {
    expect(parseReview(null).verdict).toBe("major");
    expect(parseReview({ verdict: "great" }).verdict).toBe("major");
    expect(parseReview({}).verdict).toBe("major");
  });
  it("drops non-string issues and caps the list", () => {
    const r = parseReview({ verdict: "minor", issues: [1, "x", null, ...Array(20).fill("y")] });
    expect(r.issues[0]).toBe("x");
    expect(r.issues.length).toBe(8);
  });
});
