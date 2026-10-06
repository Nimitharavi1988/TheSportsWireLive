import { describe, it, expect } from "vitest";
import { cleanDraftProblem, reviewPackKey } from "./autoDraftRules";
import type { AiDraft } from "../aiDraft";

const body = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} adds a real detail about the game.`).join(" ");
const draft = (over: Partial<AiDraft> = {}): AiDraft => ({
  title: "Why the Chiefs' receiver room is under pressure after Thornton's injury",
  summary: "Kansas City lost two receivers in one game, and the team is already looking at what comes next for the group.",
  body,
  checks: [],
  ...over,
} as AiDraft);

describe("clean review-pack drafts", () => {
  it("accepts a draft with no notes in the text", () => {
    expect(cleanDraftProblem(draft())).toBeNull();
  });
  it("rejects a draft with an [ADD] gap or a [CHECK] note left in the text", () => {
    expect(cleanDraftProblem(draft({ body: `${body} [ADD: pitch report]` }))).toBe("has notes or gaps in the text");
    expect(cleanDraftProblem(draft({ summary: "[CHECK: confirm the score] Kansas City lost two receivers in one game, and the team is already looking ahead." }))).toBe("has notes or gaps in the text");
  });
  it("still applies the ordinary draft limits", () => {
    expect(cleanDraftProblem(draft({ body: "Too short." }))).toBe("too short");
  });
  it("keys the pack by article", () => {
    expect(reviewPackKey("abc")).toBe("draft:review:abc");
  });
});
