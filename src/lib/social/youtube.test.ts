import { describe, it, expect } from "vitest";
import { shortsTitle, shortsTitleFor, shortsDescription, youtubeSlotOpen, fixShoutedTitle, shortsTags, uploadLimitPauseActive } from "./youtube";

describe("shortsTitle", () => {
  it("leaves a short headline alone (no #Shorts in the title)", () => {
    expect(shortsTitle("Messi says goodbye")).toBe("Messi says goodbye");
  });
  it("never exceeds 100 characters and ends with an ellipsis when cut", () => {
    const t = shortsTitle("A very long headline about the night the whole stadium stood and sang for the greatest player of his generation, again");
    expect(t.length).toBeLessThanOrEqual(100);
    expect(t.endsWith("…")).toBe(true);
  });
});

describe("fixShoutedTitle", () => {
  it("puts a capitals hook in sentence case, keeping names from the headline and known abbreviations", () => {
    expect(fixShoutedTitle("ARMY QB RALLIES 38-RUSHES, 223 YARDS TO BEAT TULANE", "Army QB Bryson Daily rallies past Tulane")).toBe("Army QB rallies 38-rushes, 223 yards to beat Tulane");
  });
  it("handles ordinals and dashes", () => {
    expect(fixShoutedTitle("ALLEN FORCES LATE TAP IN 5TH ROUND", "Brendan Allen forces late submission")).toBe("Allen forces late tap in 5th round");
  });
  it("leaves a normally cased hook alone", () => {
    expect(fixShoutedTitle("Iyer's 35 runs in 3 T20Is at Indore", "x")).toBe("Iyer's 35 runs in 3 T20Is at Indore");
  });
  it("ignores very short text, converts the rest", () => {
    expect(fixShoutedTitle("NFL DEAL", "x")).toBe("NFL DEAL");
    expect(fixShoutedTitle("NFL TRADE", "x")).toBe("NFL trade");
  });
});

describe("fixShoutedTitle with Spanish letters", () => {
  it("keeps accented words whole and lower-cases them", () => {
    expect(fixShoutedTitle("FORREST 70: 12 AÑOS DE ESPERA, 1 PUTT EN EL 18", "Forrest")).toBe("Forrest 70: 12 años de espera, 1 putt en el 18");
    expect(fixShoutedTitle("SIRIANNI ADMITE: NO FUE LA DECISIÓN CORRECTA", "Sirianni admite", "es")).toBe("Sirianni admite: no fue la decisión correcta");
  });
});

describe("uploadLimitPauseActive", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  it("pauses for a few hours after YouTube's upload limit error, then lets one attempt probe", () => {
    expect(uploadLimitPauseActive(null, now)).toBe(false);
    expect(uploadLimitPauseActive(new Date(now.getTime() - 60 * 60_000), now)).toBe(true);
    expect(uploadLimitPauseActive(new Date(now.getTime() - 181 * 60_000), now)).toBe(false);
  });
});

describe("shortsTitleFor", () => {
  it("uses the reel hook when there is one", () => {
    expect(shortsTitleFor("Salah scores 3 in 20 minutes", "Liverpool beat Spurs")).toBe("Salah scores 3 in 20 minutes");
  });
  it("falls back to the headline for a missing or tiny hook", () => {
    expect(shortsTitleFor(null, "Liverpool beat Spurs")).toBe("Liverpool beat Spurs");
    expect(shortsTitleFor("Wow", "Liverpool beat Spurs")).toBe("Liverpool beat Spurs");
  });
  it("no longer shouts", () => {
    expect(shortsTitleFor("SALAH SCORES 3 IN 20 MINUTES", "Mohamed Salah scores 3 for Liverpool")).toBe("Salah scores 3 in 20 minutes");
  });
});

describe("shortsDescription", () => {
  it("includes the link, asks for comments, and puts #Shorts last", () => {
    const d = shortsDescription("Summary.", "https://x.com/a", ["#Shorts", "Messi", "#Argentina"]);
    expect(d).toContain("https://x.com/a");
    expect(d).toContain("What's your take?");
    expect(d.match(/#Shorts/g)).toHaveLength(1);
    expect(d.trim().endsWith("#Messi #Argentina #Shorts")).toBe(true);
  });
  it("writes the Spanish channel description in Spanish", () => {
    const d = shortsDescription("Resumen.", "https://es.x.com/a", ["Messi"], "es");
    expect(d).toContain("Nota completa: https://es.x.com/a");
    expect(d).toContain("¿Qué opinas?");
    expect(d).toContain("Suscríbete");
    expect(d).not.toContain("Read the full story");
  });
});

describe("shortsTags", () => {
  it("puts the story's names first, then the sport phrases, then general tags", () => {
    const t = shortsTags({ category: "college-football", hashtags: ["#SteveSmith", "#SportsWireLive"], names: ["Army", "Tulane", null] });
    expect(t.slice(0, 3)).toEqual(["Steve Smith", "Army", "Tulane"]);
    expect(t).toContain("college football highlights");
    expect(t).toContain("sports news");
    expect(t.map((x) => x.toLowerCase())).not.toContain("sportswirelive");
  });
  it("has no duplicates and stays within the limits", () => {
    const t = shortsTags({ category: "mma", hashtags: ["#UFC", "#UFC"], names: ["UFC", "ufc"] });
    expect(new Set(t.map((x) => x.toLowerCase())).size).toBe(t.length);
    expect(t.length).toBeLessThanOrEqual(15);
    expect(t.join(", ").length).toBeLessThanOrEqual(500);
  });
  it("uses Spanish phrases for the Spanish channel", () => {
    const t = shortsTags({ category: "football", language: "es" });
    expect(t).toContain("noticias de fútbol");
    expect(t).toContain("noticias deportivas");
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
