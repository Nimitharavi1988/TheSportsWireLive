import { describe, it, expect } from "vitest";
import { storyTypeOf, STYLES_BY_TYPE, STYLE_GUIDE } from "./hookStyles";
import { checkHook, safeHookFromTitle } from "./hookCheck";

const SEAHAWKS = "Seattle suffered a 17-14 overtime defeat to Denver on Thursday, marking a historic statistical anomaly. The Broncos secured the victory with only 168 total yards, the lowest output for a winning team in an overtime game in league history, surpassing a 22-year-old record previously held by the 2004 Bears. The Seahawks defense recorded five sacks, two interceptions, and two forced fumbles. Will Lutz kicked the deciding field goal.";
const SABAN = "Former Alabama leader Nick Saban has publicly critiqued the potential transition to a 24-team College Football Playoff structure. During a recent media appearance, he proposed a 16-team bracket as a more balanced middle ground. Saban noted that the proposed 24-team expansion would likely result in the removal of conference title games. If a 24-team format had been in place since 2014, only Alabama and Ohio State would have maintained a perfect qualification record.";
const UFC = "Undefeated lightweight Akbar Abdullaev has officially signed with the UFC after a standout performance in this year's Dana White's Contender Series. His most recent highlight came in DWCS Week 6, where he stunned Ednilson Santos with a lightning-fast 19-second knockout. With a 100% finishing rate across 13 wins, the promotion has yet to announce his first opponent.";

describe("storyTypeOf", () => {
  it("recognises a recap, an opinion story and a signing from real stories", () => {
    expect(storyTypeOf("Seahawks make unwanted NFL history in loss vs. Broncos", SEAHAWKS)).toBe("recap");
    expect(storyTypeOf("Former Alabama HC Nick Saban Fires Back at 24-Team CFP Plan", SABAN)).toBe("opinion");
    expect(storyTypeOf("Unbeaten Phenom Teases Debut UFC Fight", UFC)).toBe("breaking");
  });
  it("recognises a preview and falls back to general", () => {
    expect(storyTypeOf("Preview: Liverpool vs Brighton, how to watch", "Kickoff is at 3pm.")).toBe("preview");
    expect(storyTypeOf("A quiet Tuesday in the league", "Nothing much happened today.")).toBe("general");
  });
});

describe("style guide", () => {  it("has a guide for every style of every type", () => {    for (const styles of Object.values(STYLES_BY_TYPE)) for (const s of styles) expect(STYLE_GUIDE[s].length).toBeGreaterThan(20);  });});
describe("checkHook", () => {
  it("rejects the unsupported 'upset' the system actually wrote", () => {
    const r = checkHook("Broncos win with 168 yards in historic upset", "Seahawks make unwanted NFL history in loss vs. Broncos", SEAHAWKS);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("upset");
  });
  it("accepts hooks that only use the article's own facts", () => {
    for (const [h, t, b] of [
      ["168 yards. One win.", "Seahawks lose to Broncos", SEAHAWKS],
      ["5 sacks. Still lost.", "Seahawks lose to Broncos", SEAHAWKS],
      ["Saban wants 16 teams, not 24", "Saban on the playoff", SABAN],
      ["Only two schools never miss a 24-team playoff", "Saban on the playoff", SABAN],
      ["13 wins. 13 finishes.", "Abdullaev signs with the UFC", UFC],
      ["19-second knockout earns Akbar Abdullaev a UFC contract", "Abdullaev signs with the UFC", UFC],
    ] as const) expect(checkHook(h, t, b), h).toEqual({ ok: true, problems: [] });
  });
  it("rejects a number, a name or a quote that is not in the article", () => {
    expect(checkHook("Broncos win with 150 yards", "x", SEAHAWKS).ok).toBe(false);
    expect(checkHook("Bryant Young stuns the league", "x", SEAHAWKS).ok).toBe(false);
    expect(checkHook("Saban: \"this ruins everything\"", "x", SABAN).ok).toBe(false);
  });
  it("accepts an exact quote and a hype word the article itself uses", () => {
    expect(checkHook("Saban: \"conference title games\"", "x", SABAN).ok).toBe(true);
    expect(checkHook("Abdullaev stunned Ednilson Santos", "x", UFC).ok).toBe(true);
  });
});

describe("safeHookFromTitle", () => {
  it("keeps a short headline and cuts a long one to ten words", () => {
    expect(safeHookFromTitle("Broncos edge Seahawks in overtime")).toBe("Broncos edge Seahawks in overtime");
    expect(safeHookFromTitle("Former Alabama HC Nick Saban Fires Back at 24-Team CFP Plan With Own Creative Alternative").split(" ").length).toBe(10);
  });
});
