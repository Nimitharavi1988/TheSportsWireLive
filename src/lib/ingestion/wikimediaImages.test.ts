import { describe, it, expect } from "vitest";
import { titleMatchesName, isFreeLicense } from "./wikimediaImages";

describe("titleMatchesName", () => {
  it("matches an exact name", () => {
    expect(titleMatchesName("Ben Stokes", "Ben Stokes")).toBe(true);
    expect(titleMatchesName("Erling Haaland", "Erling Haaland")).toBe(true);
  });

  // Regression test for a real bug: Gemini named "Sami Mokbel" (a journalist
  // merely cited as the article's source) as the story's person, and
  // Wikipedia's full-text search resolved that to "Jérémy Jacquet" — an
  // unrelated footballer's page whose references section happens to cite an
  // article Mokbel wrote. Without this check, his photo would have been
  // wrongly attached to a story about someone else entirely.
  it("rejects an unrelated page matched only via incidental text (the Sami Mokbel bug)", () => {
    expect(titleMatchesName("Jérémy Jacquet", "Sami Mokbel")).toBe(false);
  });

  it("rejects a completely unrelated title", () => {
    expect(titleMatchesName("2025–26 Tottenham Hotspur F.C. season", "Sami Mokbel")).toBe(false);
  });

  it("ignores short particles like 'de'/'du' when comparing tokens", () => {
    expect(titleMatchesName("Leus du Plooy", "Leus du Plooy")).toBe(true);
  });
});

describe("isFreeLicense", () => {
  it("accepts Public Domain, CC0, and CC-BY variants", () => {
    expect(isFreeLicense("Public domain")).toBe(true);
    expect(isFreeLicense("CC0")).toBe(true);
    expect(isFreeLicense("CC BY-SA 4.0")).toBe(true);
    expect(isFreeLicense("CC BY 3.0")).toBe(true);
  });

  it("rejects non-free/unclear licenses", () => {
    expect(isFreeLicense("Copyrighted, all rights reserved")).toBe(false);
    expect(isFreeLicense("Fair use")).toBe(false);
    expect(isFreeLicense("")).toBe(false);
  });
});
