import { describe, it, expect } from "vitest";
import { applyReview, buildReviewPrompt, parseReview } from "./paidReview";

const text = { title: "Panthers hold off Lions", summary: "Carolina won 32-26.", body: "Carolina won 32-26 in Charlotte." };

describe("paid draft review", () => {
  it("puts the facts and the draft in the prompt, and tells the reviewer not to add facts", () => {
    const p = buildReviewPrompt(text, ["The Panthers beat the Lions 32-26."]);
    expect(p).toContain("- The Panthers beat the Lions 32-26.");
    expect(p).toContain("Headline: Panthers hold off Lions");
    expect(p).toContain("Never add any fact that is not in the FACTS");
  });

  it("reads the model's answer safely", () => {
    expect(parseReview({ verdict: "pass", problems: [] })).toEqual({ verdict: "pass", problems: [] });
    expect(parseReview({ verdict: "reject", problems: ["The Raiders are already 3-1", " "] })).toEqual({ verdict: "reject", problems: ["The Raiders are already 3-1"] });
    expect(parseReview({ verdict: "fix", problems: ["Hutchinson is a defensive end"], title: "T", summary: "S", body: "B" })?.corrected).toEqual({ title: "T", summary: "S", body: "B" });
    expect(parseReview({ verdict: "fix", problems: ["x"], title: "T", summary: "", body: "B" })).toBeNull(); // a fix needs all three parts
    expect(parseReview({ verdict: "maybe" })).toBeNull();
    expect(parseReview(null)).toBeNull();
    expect(parseReview("pass")).toBeNull();
  });

  it("carries on with the original on a pass, the corrected text on a fix, and drops a reject", () => {
    const pass = applyReview(text, { verdict: "pass", problems: [] });
    expect(pass).toMatchObject({ ok: true, text });
    const fixed = applyReview(text, { verdict: "fix", problems: ["wrong position"], corrected: { title: "T2", summary: "S2", body: "B2" } });
    expect(fixed).toMatchObject({ ok: true, text: { title: "T2", body: "B2" } });
    expect(fixed.ok && fixed.notes.join(" ")).toContain("wrong position");
    const rejected = applyReview(text, { verdict: "reject", problems: ["contradicts itself", "invented grade"] });
    expect(rejected).toEqual({ ok: false, reason: "paid review rejected it: contradicts itself; invented grade" });
  });
});
