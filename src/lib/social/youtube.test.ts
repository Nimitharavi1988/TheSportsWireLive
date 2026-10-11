import { describe, it, expect } from "vitest";
import { shortsTitle, shortsTitleFor, shortsDescription } from "./youtube";

describe("shortsTitle", () => {
  it("appends #Shorts to a short headline", () => {
    expect(shortsTitle("Messi says goodbye")).toBe("Messi says goodbye #Shorts");
  });
  it("never exceeds 100 characters and keeps the tag", () => {
    const t = shortsTitle("A very long headline about the night the whole stadium stood and sang for the greatest player of his generation");
    expect(t.length).toBeLessThanOrEqual(100);
    expect(t.endsWith("… #Shorts")).toBe(true);
  });
});

describe("shortsTitleFor", () => {
  it("uses the reel hook when there is one", () => {
    expect(shortsTitleFor("Salah scores 3 in 20 minutes", "Liverpool beat Spurs")).toBe("Salah scores 3 in 20 minutes #Shorts");
  });
  it("falls back to the headline for a missing or tiny hook", () => {
    expect(shortsTitleFor(null, "Liverpool beat Spurs")).toBe("Liverpool beat Spurs #Shorts");
    expect(shortsTitleFor("Wow", "Liverpool beat Spurs")).toBe("Liverpool beat Spurs #Shorts");
  });
});

describe("shortsDescription", () => {
  it("includes the link and dedupes #Shorts", () => {
    const d = shortsDescription("Summary.", "https://x.com/a", ["#Shorts", "Messi"]);
    expect(d).toContain("https://x.com/a");
    expect(d.match(/#Shorts/g)).toHaveLength(1);
    expect(d).toContain("#Messi");
  });
});
