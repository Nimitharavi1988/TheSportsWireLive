import { describe, it, expect } from "vitest";
import { reelThemeFor, REEL_THEME_NAMES } from "./reelThemes";

describe("reelThemeFor", () => {
  const ids = Array.from({ length: 400 }, (_, i) => `story-${i}-xyz`);
  it("is stable for a story and always a real theme", () => {
    for (const id of ids.slice(0, 50)) {
      expect(reelThemeFor(id, "cricket")).toBe(reelThemeFor(id, "cricket"));
      expect(REEL_THEME_NAMES).toContain(reelThemeFor(id, "cricket"));
    }
  });
  it("keeps about a quarter of stories on brand green", () => {
    const green = ids.filter((id) => reelThemeFor(id, "football") === "green").length;
    expect(green / ids.length).toBeGreaterThan(0.18);
    expect(green / ids.length).toBeLessThan(0.32);
  });
  it("uses only the sport's pool for the other three quarters", () => {
    const seen = new Set(ids.map((id) => reelThemeFor(id, "mma")));
    expect([...seen].every((t) => ["green", "red", "gold", "purple"].includes(t))).toBe(true);
    expect(seen.size).toBe(4);
  });
  it("handles subcategories and unknown sports", () => {
    expect(REEL_THEME_NAMES).toContain(reelThemeFor("a", "basketball/nba"));
    expect(REEL_THEME_NAMES).toContain(reelThemeFor("a", "curling"));
    expect(REEL_THEME_NAMES).toContain(reelThemeFor("a", null));
  });
});
