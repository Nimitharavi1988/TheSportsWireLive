import { describe, it, expect } from "vitest";
import { isSimilarTitle, isSimilarToAny } from "./titleSimilarity";

describe("isSimilarTitle", () => {
  // The original target case, verified live 2026-09-20 against the real
  // headlines that caused 4-6 duplicate Facebook posts about one Salah
  // hat-trick from different outlets.
  it("flags real near-duplicate coverage of the same event from different outlets", () => {
    expect(
      isSimilarTitle(
        "Mohamed Salah Fires a First Trabzonspor Hat Trick as Trabzonspor Crush",
        "Salah scores hat-trick as Trabzonspor beat Galatasaray in Turkish league"
      )
    ).toBe(true);
  });

  it("does not flag a genuinely different angle on the same broader topic", () => {
    expect(
      isSimilarTitle(
        "Mohamed Salah Has Already Scored 7 Goals for Trabzonspor This Season",
        "'Big matches require big players!' – Fabinho raves about Mohamed Salah"
      )
    ).toBe(false);
  });

  // Real bug found live 2026-09-20, hours after the ratio-only version
  // shipped: a bare match-result template has so few significant words
  // that sharing just the two team names with an unrelated headline
  // already clears the ratio threshold, blocking every fresh Facebook
  // candidate in one run (all 96 wrongly matched something in the day's
  // posted-title history).
  it("does not flag two short match-result titles that merely share team names", () => {
    expect(
      isSimilarTitle("Colorado Rockies 4-5 Seattle Mariners", "Seattle Mariners' bullpen falters in ninth inning collapse")
    ).toBe(false);
  });

  it("does not flag two unrelated short titles sharing one proper noun", () => {
    expect(isSimilarTitle("Zampa takes 3 wickets", "Zampa signs new deal with South Australia")).toBe(false);
  });

  it("still flags two genuinely identical bare match-result templates", () => {
    expect(
      isSimilarTitle("Colorado Rockies 4-5 Seattle Mariners", "Colorado Rockies 4-5 Seattle Mariners")
    ).toBe(true);
  });
});

describe("isSimilarToAny", () => {
  it("checks against every title in the list", () => {
    const others = ["Unrelated headline about cricket", "Salah scores hat-trick as Trabzonspor beat Galatasaray"];
    expect(isSimilarToAny("Mohamed Salah Fires a First Trabzonspor Hat Trick as Trabzonspor Crush", others)).toBe(true);
  });

  it("returns false when nothing in the list is similar", () => {
    expect(isSimilarToAny("Colorado Rockies 4-5 Seattle Mariners", ["Texas Rangers 6-2 Toronto Blue Jays"])).toBe(false);
  });
});
