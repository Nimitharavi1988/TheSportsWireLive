import { describe, it, expect } from "vitest";
import { articleWords, isThinRewrite, MIN_INDEXED_WORDS } from "./thinContent";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const rewrite = (body: string | null, title = "Rays take Game 1", summary = "A short summary.") => ({ sourceName: "MLB.com", title, body, summary });

describe("thin content", () => {
  it("counts the body's words, or the summary's when there's no body", () => {
    expect(articleWords({ body: "  one two\n\nthree  ", summary: "x" })).toBe(3);
    expect(articleWords({ body: "   ", summary: "four five" })).toBe(2);
    expect(articleWords({ body: null, summary: null })).toBe(0);
  });

  it("noindexes a short write-up of another outlet's story", () => {
    expect(isThinRewrite(rewrite(words(MIN_INDEXED_WORDS - 1)))).toBe(true);
    expect(isThinRewrite(rewrite(words(MIN_INDEXED_WORDS)))).toBe(false);
  });

  it("noindexes threads, streams and TV guides whatever their length", () => {
    expect(isThinRewrite(rewrite(words(500), "Open Thread: Blues @ Avalanche"))).toBe(true);
    expect(isThinRewrite(rewrite(words(500), "How to Watch Cowboys vs. Texans: TV Channel"))).toBe(true);
  });

  it("never noindexes an original story, however short", () => {
    expect(isThinRewrite({ sourceName: "Sports Wire Live", title: "Open thread", body: words(50), summary: "" })).toBe(false);
  });
});
