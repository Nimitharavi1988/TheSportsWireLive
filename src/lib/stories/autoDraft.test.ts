import { describe, it, expect } from "vitest";
import { draftBodyWithChecks, draftProblem, pickIdeas } from "./autoDraftRules";
import { publishProblems } from "../stories";
import type { StoryIdea } from "../storyIdeas";

const idea = (key: string, kind: StoryIdea["kind"]): StoryIdea => ({
  key, kind, sport: "cricket", headline: key, reason: "", storyKind: "analysis", seriesKey: null, tags: [], brief: "", sources: [], at: new Date(),
});

describe("auto drafts", () => {
  it("takes one idea per kind in turn", () => {
    const ideas = [idea("t1", "trend"), idea("t2", "trend"), idea("r1", "report"), idea("p1", "preview"), idea("p2", "preview")];
    expect(pickIdeas(ideas, 2).map((i) => i.key)).toEqual(["t1", "r1"]);
    expect(pickIdeas(ideas, 4).map((i) => i.key)).toEqual(["t1", "r1", "p1", "t2"]);
    expect(pickIdeas(ideas, 10)).toHaveLength(5);
    expect(pickIdeas([], 3)).toEqual([]);
  });

  it("keeps the facts to verify in the body so publishing is blocked until they're cleared", () => {
    const body = draftBodyWithChecks({ body: "x".repeat(900), checks: ["India won by 8 wickets", "Series is 3 matches [sic]"] });
    expect(body).toContain("[CHECK: India won by 8 wickets]");
    expect(body).toContain("[CHECK: Series is 3 matches sic]");
    const input = { title: "A headline long enough", summary: "s".repeat(80), body, category: "cricket", heroImageUrl: "https://x/y.jpg" };
    expect(publishProblems(input, ["cricket"])).toContain("Replace the [ADD: …] notes with real details first.");
  });

  it("rejects thin drafts", () => {
    const ok = { title: "Why the opening slot is the question", summary: "s".repeat(100), body: "b".repeat(1000), checks: [] };
    expect(draftProblem(ok)).toBeNull();
    expect(draftProblem({ ...ok, body: "short" })).toBe("too short");
    expect(draftProblem({ ...ok, body: `${"b".repeat(1000)} [ADD: a] [ADD: b] [ADD: c] [ADD: d] [ADD: e]` })).toBe("too many gaps");
    expect(draftProblem({ ...ok, title: "Hi" })).toBe("headline length");
  });
});
