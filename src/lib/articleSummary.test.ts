import { describe, it, expect } from "vitest";
import { displaySummary } from "./articleSummary";

describe("displaySummary", () => {
  it("falls back to summary when body is null", () => {
    expect(displaySummary({ summary: "Full coverage from BBC Sport.", body: null })).toBe(
      "Full coverage from BBC Sport."
    );
  });

  it("uses body as-is when it's within the length limit", () => {
    const body = "Arsenal beat Chelsea 2-1 at the Emirates.";
    expect(displaySummary({ summary: "generic", body }, 200)).toBe(body);
  });

  it("truncates a long body at a word boundary with an ellipsis", () => {
    const body = "Arsenal maintained their flawless start to the Premier League season on Sunday, edging out Chelsea in a hard-fought 2-1 victory that leaves the Gunners on top of the table.";
    const result = displaySummary({ summary: "generic", body }, 60);
    expect(result.length).toBeLessThanOrEqual(61); // 60 + ellipsis char
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith(" …")).toBe(false); // no dangling space before ellipsis
  });
});
