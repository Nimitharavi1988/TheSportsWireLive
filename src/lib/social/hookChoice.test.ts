import { describe, it, expect } from "vitest";
import { chooseHook, scoreHook, EXPLORE_SHARE, type HookCandidate } from "./hookChoice";

const SABAN = "Former Alabama leader Nick Saban has publicly critiqued the potential transition to a 24-team College Football Playoff structure. During a recent media appearance, he proposed a 16-team bracket as a more balanced middle ground. Saban noted that the proposed 24-team expansion would likely result in the removal of conference title games.";
const SEAHAWKS = "Seattle suffered a 17-14 overtime defeat to Denver on Thursday. The Broncos secured the victory with only 168 total yards, the lowest output for a winning team in an overtime game in league history. The Seahawks defense recorded five sacks, two interceptions, and two forced fumbles.";

// The candidates the live model wrote for these stories on 2026-10-16.
const saban: HookCandidate[] = [
  { style: "reaction", hook: "Nick Saban critiques proposed 24-team CFP transition" },
  { style: "hottake", hook: "Nick Saban wants 16-team CFP, not 24" },
  { style: "question", hook: "Why does Nick Saban oppose a 24-team CFP?" },
  { style: "model", hook: "Nick Saban proposes 16-team bracket instead of 24" },
];
const seahawks: HookCandidate[] = [
  { style: "number", hook: "168 total yards. Still won in overtime." },
  { style: "contrast", hook: "5 sacks and 4 turnovers. Still lost." },
  { style: "record", hook: "Lowest yards ever for an overtime win: 168" },
];

describe("scoreHook", () => {
  it("prefers a contrast to a report-like description", () => {
    expect(scoreHook("Nick Saban wants 16-team CFP, not 24", "hottake", "x")).toBeGreaterThan(scoreHook("Nick Saban critiques proposed 24-team CFP transition", "reaction", "x"));
  });
  it("marks down a hook that is just the headline again", () => {
    expect(scoreHook("Seahawks lose to Broncos in overtime", "model", "Seahawks lose to Broncos in overtime")).toBeLessThan(scoreHook("168 yards. Still won.", "number", "Seahawks lose to Broncos in overtime"));
  });
});

describe("chooseHook", () => {
  it("rejects the candidate with a number the article does not state, and picks the best of the rest", () => {
    const c = chooseHook(seahawks, "Seahawks lose to Broncos", SEAHAWKS, "story-a");
    expect(c.candidates.find((k) => k.hook.includes("4 turnovers"))?.ok).toBe(false);
    expect(c.hook).not.toContain("4 turnovers");
    expect(["best", "explore"]).toContain(c.by);
  });
  it("picks the sharper Saban hook over the report-like one when exploring is off for that story", () => {
    let picked = 0, tried = 0;
    for (let i = 0; i < 200; i++) { const c = chooseHook(saban, "Saban on the playoff", SABAN, `id-${i}`); if (c.by === "best") { tried++; if (c.hook === "Nick Saban wants 16-team CFP, not 24") picked++; } }
    expect(picked).toBe(tried);
  });
  it("explores on about its share of stories, and always returns a valid hook", () => {
    let explored = 0;
    for (let i = 0; i < 1000; i++) { const c = chooseHook(saban, "Saban on the playoff", SABAN, `story-${i}`); if (c.by === "explore") explored++; expect(c.candidates.find((k) => k.hook === c.hook)?.ok).toBe(true); }
    expect(explored / 1000).toBeGreaterThan(EXPLORE_SHARE - 0.08);
    expect(explored / 1000).toBeLessThan(EXPLORE_SHARE + 0.08);
  });
  it("falls back to the headline when no candidate is valid", () => {
    const c = chooseHook([{ style: "number", hook: "Broncos win with 150 yards" }], "Broncos edge Seahawks in overtime", SEAHAWKS, "x");
    expect(c).toMatchObject({ by: "fallback", style: "fallback", hook: "Broncos edge Seahawks in overtime" });
  });
});
