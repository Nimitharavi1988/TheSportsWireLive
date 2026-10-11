import { describe, expect, it } from "vitest";
import { checkFeedback, checkRating, checkVoice, hasContactOrLink } from "./fanFeedback";

describe("checkRating", () => {
  it("accepts whole numbers 1 to 5 only", () => {
    expect(checkRating(1)).toEqual({ ok: true, value: 1 });
    expect(checkRating(5)).toEqual({ ok: true, value: 5 });
    for (const bad of [0, 6, 2.5, "3", null, undefined]) expect(checkRating(bad).ok).toBe(false);
  });
});

describe("hasContactOrLink", () => {
  it("catches links, emails and phone numbers but not normal sports talk", () => {
    for (const bad of ["see https://x.com/a", "visit www.bets.io", "great at fanbets.com", "me@mail.com", "call 555 123 4567"]) {
      expect(hasContactOrLink(bad)).toBe(true);
    }
    for (const ok of ["Arsenal won 3-1 and Saka was brilliant", "Rated 9/10, 2 goals in the 87th minute", "We scored 2.5 goals on average"]) {
      expect(hasContactOrLink(ok)).toBe(false);
    }
  });
});

describe("checkFeedback", () => {
  it("accepts a thumb with an optional clean note", () => {
    expect(checkFeedback({ sentiment: "up" })).toEqual({ ok: true, value: { sentiment: "up", note: null, page: null } });
    expect(checkFeedback({ sentiment: "down", note: "  Scores   load slowly ", page: "/scores" })).toEqual({
      ok: true,
      value: { sentiment: "down", note: "Scores load slowly", page: "/scores" },
    });
  });
  it("rejects bad input", () => {
    expect(checkFeedback(null).ok).toBe(false);
    expect(checkFeedback({ sentiment: "meh" }).ok).toBe(false);
    expect(checkFeedback({ sentiment: "up", note: "x".repeat(301) }).ok).toBe(false);
    expect(checkFeedback({ sentiment: "up", note: "go to www.spam.com" }).ok).toBe(false);
    expect(checkFeedback({ sentiment: "up", note: "this is shit" }).ok).toBe(false);
  });
  it("flags the honeypot as spam and drops off-site page values", () => {
    expect(checkFeedback({ sentiment: "up", website: "x" })).toEqual({ ok: false, error: "spam" });
    const r = checkFeedback({ sentiment: "up", page: "https://evil.example" });
    expect(r.ok && r.value.page).toBeNull();
  });
});

describe("checkVoice", () => {
  const body = "Great game from both sides, the second half was end to end and the winner was worth the wait.";
  it("accepts a clean take and trims it", () => {
    const r = checkVoice({ name: " Sam ", country: "USA", body });
    expect(r).toEqual({ ok: true, value: { name: "Sam", country: "USA", body } });
    expect(checkVoice({ name: "Sam", body }).ok).toBe(true);
  });
  it("enforces length, links, language and the honeypot", () => {
    expect(checkVoice({ name: "S", body }).ok).toBe(false);
    expect(checkVoice({ name: "Sam", body: "Too short to count." }).ok).toBe(false);
    expect(checkVoice({ name: "Sam", body: Array(160).fill("word").join(" ") }).ok).toBe(false);
    expect(checkVoice({ name: "Sam", body: `${body} Bet at www.bets.com` }).ok).toBe(false);
    expect(checkVoice({ name: "Sam", body: `${body} What a bastard of a referee` }).ok).toBe(false);
    expect(checkVoice({ name: "Sam", body, website: "http://x" })).toEqual({ ok: false, error: "spam" });
  });
});
