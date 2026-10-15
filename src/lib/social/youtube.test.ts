import { describe, it, expect } from "vitest";
import { shortsTitle, shortsTitleFor, shortsDescription, youtubeSlotOpen, youtubeSportAllowed, decorateShortsTitle, titleVariantFor, fixShoutedTitle, shortsTags, uploadLimitPauseActive, hookNamesSomeone } from "./youtube";

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

describe("hookNamesSomeone", () => {
  it("accepts hooks with a person, team, place or abbreviation", () => {
    for (const h of ["Bills edge Rams 37-34 in overtime thriller", "Caitlin Clark's 1s hit the NBA floor", "Georgia takes number one after Texas upset", "Julian Reese averaged 11.8 PPG in his NBA debut", "Jaguars ganan 19-17 ante los Eagles en Londres"]) expect(hookNamesSomeone(h)).toBe(true);
  });
  it("rejects hooks that name nobody", () => {
    for (const h of ["18-Year-old signed through 2030", "Why is this happening now?", "150% ticket price surge sells out in 60 seconds".replace("150%", "150%")]) expect(hookNamesSomeone(h)).toBe(false);
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
  it("falls back to the headline when the hook names nobody", () => {
    expect(shortsTitleFor("18-Year-old signed through 2030", "Modern Adventure signs 18-year-old Leo Hayter through 2030")).toBe("Modern Adventure signs 18-year-old Leo Hayter through 2030");
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

describe("youtubeSportAllowed", () => {
  it("lets a priority sport use any open slot, including the reserved ones", () => {
    expect(youtubeSportAllowed("en", "cricket", 7, 8, 3)).toBe(true);
    expect(youtubeSportAllowed("en", "wnba", 7, 8, 3)).toBe(true);
    expect(youtubeSportAllowed("es", "tennis", 7, 8, 3)).toBe(true);
  });
  it("keeps the last slots for priority sports only", () => {
    expect(youtubeSportAllowed("en", "american-football/nfl", 5, 8, 3)).toBe(false);
    expect(youtubeSportAllowed("en", "mma", 7, 8, 3)).toBe(false);
  });
  it("lets other sports use the earlier slots of the day", () => {
    expect(youtubeSportAllowed("en", "american-football/nfl", 4, 8, 3)).toBe(true);
    expect(youtubeSportAllowed("es", "golf", 0, 8, 3)).toBe(true);
  });
  it("is per channel (NFL is a Spanish priority, not an English one)", () => {
    expect(youtubeSportAllowed("es", "american-football", 7, 8, 3)).toBe(true);
    expect(youtubeSportAllowed("en", "american-football", 7, 8, 3)).toBe(false);
  });
  it("a reserve of 0 turns the gate off", () => {
    expect(youtubeSportAllowed("en", "mma", 7, 8, 0)).toBe(true);
  });
});

describe("decorateShortsTitle", () => {
  it("puts the sport emoji first and up to two hashtags after the title", () => {
    expect(decorateShortsTitle("Sanju Samson hits 82 against West Indies", "🏏", ["#cricket", "IndVsWI", "#extra"])).toBe("🏏 Sanju Samson hits 82 against West Indies #cricket #IndVsWI");
  });
  it("never exceeds 100 characters: fewer hashtags first, then none, then a plain title", () => {
    const t90 = "x".repeat(87);
    expect(decorateShortsTitle(t90, "⚽", ["#football", "#premierleague"], 100)).toBe("⚽ " + t90 + " #football");
    const t96 = "x".repeat(96);
    expect(decorateShortsTitle(t96, "⚽", ["#a1", "#b2"], 100)).toBe("⚽ " + t96);
    const t99 = "x".repeat(99);
    expect(decorateShortsTitle(t99, "⚽", ["#a1", "#b2"], 100)).toBe(t99);
    // Real titles are already capped at 100 characters (shortsTitle) before they are decorated.
    const long = "A very long headline about the night the whole stadium stood and sang for the greatest player of his generation".slice(0, 95);
    expect(decorateShortsTitle(long, "⚽", ["#football", "#premierleague"]).length).toBeLessThanOrEqual(100);
    expect(decorateShortsTitle(long, "⚽", ["#football"])).not.toContain("…");
  });
  it("puts the story's own hashtags before the generic ones", () => {
    expect(decorateShortsTitle("Alcaraz eliminado en Shanghái", "🎾", ["#Deportes", "#SportsWireLive", "#Alcaraz", "#ATP"])).toBe("🎾 Alcaraz eliminado en Shanghái #Alcaraz #ATP");
    expect(decorateShortsTitle("Brewers vencen a Dodgers", "⚾", ["#Beisbol", "#Deportes", "#SportsWireLive"])).toBe("⚾ Brewers vencen a Dodgers #Beisbol #Deportes");
  });
  it("leaves a title that already has an emoji or a hashtag without a second one, and ignores #Shorts", () => {
    expect(decorateShortsTitle("Messi says goodbye 😢", "⚽", ["#messi"])).toBe("Messi says goodbye 😢 #messi");
    expect(decorateShortsTitle("Messi says goodbye #messi", "⚽", ["#football"])).toBe("⚽ Messi says goodbye #messi");
    expect(decorateShortsTitle("Messi says goodbye", null, ["#Shorts"])).toBe("Messi says goodbye");
  });
});

describe("titleVariantFor", () => {
  it("is stable per story and splits roughly in half", () => {
    expect(titleVariantFor("abc")).toBe(titleVariantFor("abc"));
    const ids = Array.from({ length: 400 }, (_, i) => `cm${i}story${i * 7}`);
    const dec = ids.filter((i) => titleVariantFor(i) === "decorated").length;
    expect(dec).toBeGreaterThan(150);
    expect(dec).toBeLessThan(250);
  });
});
