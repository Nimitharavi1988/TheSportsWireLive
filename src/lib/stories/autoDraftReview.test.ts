import { describe, it, expect } from "vitest";
import { cleanDraftProblem, reviewPackKey } from "./autoDraftRules";
import type { AiDraft } from "../aiDraft";

const NAMES = ["Walker", "Hubbard", "Mahomes", "Kelce", "Rice", "Thornton", "Bowers", "Jeanty", "Cousins", "Nwankpa"];
const body = Array.from({ length: 40 }, (_, i) => `On play ${i * 3 + 1}, ${NAMES[i % 10]} gained ${i + 12} yards while defender number ${i * 7 + 2} slipped; the crowd of ${40000 + i * 137} noticed immediately.`).join(" ");
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
  it("rejects a draft under the length bar (originals are always indexed, so short ones would be thin indexed pages)", () => {
    const short = Array.from({ length: 12 }, (_, i) => `Short detail ${i} about the match and what it meant for both sides on the day.`).join(" ");
    expect(short.length).toBeGreaterThan(150);
    expect(cleanDraftProblem(draft({ body: short }))).toBe("under the length bar");
  });
  it("rejects a draft that talks about its inputs", () => {
    expect(cleanDraftProblem(draft({ body: `${body} The provided facts do not say more.` }))).toBe("talks about its own inputs");
  });
  it("still applies the ordinary draft limits", () => {
    expect(cleanDraftProblem(draft({ body: "Too short." }))).toBe("too short");
  });
  it("keys the pack by article", () => {
    expect(reviewPackKey("abc")).toBe("draft:review:abc");
  });
});
