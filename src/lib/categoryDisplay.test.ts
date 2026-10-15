import { describe, expect, it } from "vitest";
import { categoryChipStyle, chipOutlineSx, chipTextSx, contrastRatio, darkTextColor } from "./categoryDisplay";

const CATEGORIES = [
  "football", "football/world-cup", "cricket", "american-football", "college-football", "athletics", "baseball", "basketball",
  "wnba", "rugby", "hockey", "volleyball", "formula-1", "tennis", "boxing", "mma", "motogp", "cycling", "golf", "padel",
];

describe("sport colours in dark mode", () => {
  it("keeps the original colour untouched for light mode", () => {
    expect(categoryChipStyle("cricket").color).toBe("#935b20");
    expect(categoryChipStyle("american-football").color).toBe("#6b3fa0");
    expect(categoryChipStyle("not-a-sport").color).toBe("#6b6b6b");
  });

  it("gives every sport a dark-mode text colour that is readable on the dark card (4.5:1)", () => {
    for (const c of CATEGORIES) {
      const { darkColor } = categoryChipStyle(c);
      expect(contrastRatio(darkColor, "#1c201d"), c).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(categoryChipStyle("not-a-sport").darkColor, "#1c201d")).toBeGreaterThanOrEqual(4.5);
  });

  it("lightens only as much as needed and leaves a colour that already passes alone", () => {
    expect(darkTextColor("#3ecf8e")).toBe("#3ecf8e");
    expect(darkTextColor("#4a4a4a")).not.toBe("#4a4a4a");
  });

  it("builds sx fragments with the dark override", () => {
    const chip = categoryChipStyle("cricket");
    expect(chipTextSx(chip)).toEqual({ color: "#935b20", "@media (prefers-color-scheme: dark)": { color: chip.darkColor } });
    expect(chipOutlineSx(chip)["@media (prefers-color-scheme: dark)"]).toEqual({ color: chip.darkColor, borderColor: chip.darkColor });
  });
});
