import { describe, it, expect } from "vitest";
import { crestAltText } from "./teamNames";

describe("crestAltText", () => {
  it("parses a finished-match summary ('played ... in the ...')", () => {
    const { home, away } = crestAltText(
      "Manchester City FC played AFC Bournemouth in the Premier League, finishing 2-1."
    );
    expect(home).toBe("Manchester City FC crest");
    expect(away).toBe("AFC Bournemouth crest");
  });

  it("parses a preview summary ('face ... in the ... on ...')", () => {
    const { home, away } = crestAltText(
      "CD Nacional face FC Famalicão in the Primeira Liga on Sep 19."
    );
    expect(home).toBe("CD Nacional crest");
    expect(away).toBe("FC Famalicão crest");
  });

  it("falls back to generic labels when the pattern doesn't match", () => {
    const { home, away } = crestAltText("Some unrelated summary text.");
    expect(home).toBe("Home team crest");
    expect(away).toBe("Away team crest");
  });
});
