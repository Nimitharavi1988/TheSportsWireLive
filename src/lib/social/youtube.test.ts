import { describe, it, expect } from "vitest";
import { shortsTitle, shortsTitleFor, shortsDescription, youtubeSlotOpen } from "./youtube";

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

describe("youtubeSlotOpen", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  it("opens when nothing was posted", () => expect(youtubeSlotOpen(0, null, now, 8, 120)).toBe(true));
  it("stays closed inside the minimum gap", () => expect(youtubeSlotOpen(2, ago(90), now, 8, 120)).toBe(false));
  it("opens once the gap has passed", () => expect(youtubeSlotOpen(2, ago(121), now, 8, 120)).toBe(true));
  it("stays closed at the daily cap", () => expect(youtubeSlotOpen(8, ago(600), now, 8, 120)).toBe(false));
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
  it("writes the Spanish channel description in Spanish", () => {
    const d = shortsDescription("Resumen.", "https://es.x.com/a", ["Messi"], "es");
    expect(d).toContain("Nota completa: https://es.x.com/a");
    expect(d).toContain("Suscríbete");
    expect(d).not.toContain("Read the full story");
  });
  it("includes the link and dedupes #Shorts", () => {
    const d = shortsDescription("Summary.", "https://x.com/a", ["#Shorts", "Messi"]);
    expect(d).toContain("https://x.com/a");
    expect(d.match(/#Shorts/g)).toHaveLength(1);
    expect(d).toContain("#Messi");
  });
});
