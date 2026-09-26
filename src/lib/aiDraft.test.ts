import { describe, it, expect } from "vitest";
import { blocksToBody, buildDraftPrompt } from "./aiDraft";

describe("AI draft", () => {
  it("joins blocks into the editor's format", () => {
    expect(blocksToBody([
      { kind: "paragraph", text: "India open the series in  Thiruvananthapuram." },
      { kind: "subheading", text: "## Selection questions" },
      { kind: "paragraph", text: "[ADD: confirmed XI]" },
      { kind: "paragraph", text: "   " },
    ])).toBe("India open the series in Thiruvananthapuram.\n\n## Selection questions\n\n[ADD: confirmed XI]");
  });

  it("gives the model only the facts it has, and the rules", () => {
    const p = buildDraftPrompt({
      brief: "Preview the 1st ODI",
      kindLabel: "Preview",
      sportLabel: "Cricket",
      seriesLabel: "India vs West Indies • ODI",
      fixtures: ["Sep 27: India vs West Indies at Greenfield International Stadium (upcoming)"],
      venues: [],
      people: ["India (team)"],
      recentStories: [],
    });
    expect(p).toContain("Sep 27: India vs West Indies");
    expect(p).toContain("[ADD:");
    expect(p).toContain("Never invent");
    expect(p).not.toContain("Ground:");
  });
});
