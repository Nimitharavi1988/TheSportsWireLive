import { describe, expect, it } from "vitest";
import { REEL_MUSIC_STYLE_NAMES, generateReelMusic, musicStyleFor, stylePoolFor } from "./reelMusic";

function stats(wav: Buffer) {
  let peak = 0, sum = 0;
  const n = (wav.length - 44) / 2;
  for (let i = 0; i < n; i++) {
    const v = wav.readInt16LE(44 + i * 2) / 32768;
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  return { peak, rmsDb: 20 * Math.log10(Math.sqrt(sum / n)) };
}

describe("reel music styles", () => {
  it("has the original seven plus the five added ones", () => {
    expect(REEL_MUSIC_STYLE_NAMES).toEqual(expect.arrayContaining(["drive", "anthem", "trap", "chill", "smooth", "ambient", "cinematic", "hype", "dance", "lofi", "epic", "groove"]));
    expect(REEL_MUSIC_STYLE_NAMES).toHaveLength(12);
  });

  it("renders every style as a non-silent, unclipped track", () => {
    for (const name of REEL_MUSIC_STYLE_NAMES) {
      const { peak, rmsDb } = stats(generateReelMusic(4, name));
      expect(peak, name).toBeGreaterThan(0.3);
      expect(peak, name).toBeLessThanOrEqual(1);
      expect(rmsDb, name).toBeGreaterThan(-30);
    }
  });

  it("starts the new styles' drums within the first second", () => {
    // Energy in the first second vs a style with a full-bar intro.
    const first = (name: Parameters<typeof generateReelMusic>[1]) => {
      const wav = generateReelMusic(3, name);
      let sum = 0;
      for (let i = 0; i < 44100 * 2; i++) sum += (wav.readInt16LE(44 + i * 2) / 32768) ** 2;
      return Math.sqrt(sum / (44100 * 2));
    };
    expect(first("hype")).toBeGreaterThan(first("drive"));
  });
});

describe("musicStyleFor", () => {
  it("is stable per story and always a real style", () => {
    const story = { title: "India beat Pakistan to win Asian Games gold", category: "cricket" };
    expect(musicStyleFor("abc", story)).toBe(musicStyleFor("abc", story));
    expect(REEL_MUSIC_STYLE_NAMES).toContain(musicStyleFor("abc", story));
    expect(REEL_MUSIC_STYLE_NAMES).toContain(musicStyleFor("abc"));
  });

  it("matches mood first, then sport, then falls back to every style", () => {
    expect(stylePoolFor({ title: "Coach slams referees in controversial finish", category: "college-football" })).toContain("cinematic");
    expect(stylePoolFor({ title: "Star ruled out with injury", category: "basketball" })).toContain("smooth");
    expect(stylePoolFor({ title: "Kohli scores a century", category: "cricket" })).toContain("dance");
    expect(stylePoolFor({ title: "Practice report", category: "cricket" })).toContain("groove");
    expect(stylePoolFor({ title: "Practice report", category: "rugby" })).toEqual(REEL_MUSIC_STYLE_NAMES);
  });
});
