import { describe, it, expect } from "vitest";
import { parseHeadlines } from "./foreignHeadlines";

describe("parseHeadlines", () => {
  it("returns the trimmed headlines when the count matches", () => {
    expect(parseHeadlines({ titles: [" A ", "B"] }, 2)).toEqual(["A", "B"]);
  });
  it("rejects a wrong count, an empty line or junk", () => {
    expect(parseHeadlines({ titles: ["A"] }, 2)).toBeNull();
    expect(parseHeadlines({ titles: ["A", " "] }, 2)).toBeNull();
    expect(parseHeadlines({ titles: ["A", 3] }, 2)).toBeNull();
    expect(parseHeadlines(null, 1)).toBeNull();
  });
});
