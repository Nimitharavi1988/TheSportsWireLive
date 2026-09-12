import { describe, it, expect } from "vitest";
import { deriveSeriesKey, detectSeriesFormat, matchSeriesInTitle, type ActiveSeries } from "./cricketSeries";

describe("detectSeriesFormat", () => {
  it("matches singular format words", () => {
    expect(detectSeriesFormat("India vs Afghanistan, 1st T20I")).toBe("T20I");
    expect(detectSeriesFormat("3rd ODI: Australia beat England")).toBe("ODI");
    expect(detectSeriesFormat("2nd Test at Lord's")).toBe("Test");
  });

  // Real-world editorial headlines overwhelmingly use the plural, which a
  // bare \bT20I\b boundary check misses (no boundary between "I" and "s").
  it("matches the plural form used in real editorial headlines", () => {
    expect(detectSeriesFormat("India squad for Afghanistan T20I series 2026")).toBe("T20I");
    expect(detectSeriesFormat("Ahead of Afghanistan T20Is")).toBe("T20I");
    expect(detectSeriesFormat("England's ODIs against Australia")).toBe("ODI");
  });

  it("returns null when no format is mentioned", () => {
    expect(detectSeriesFormat("Sanju Samson announces scholarships for UPSC aspirants")).toBeNull();
  });
});

describe("deriveSeriesKey", () => {
  it("derives a stable key/label regardless of home/away order", () => {
    const a = deriveSeriesKey("India", "Afghanistan", "India vs Afghanistan, 1st T20I");
    const b = deriveSeriesKey("Afghanistan", "India", "Afghanistan vs India, 1st T20I");
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(a!.key).toBe("afghanistan-vs-india-t20i");
    expect(a!.label).toBe("Afghanistan vs India • T20I");
  });

  // Afghanistan is deliberately excluded from cricketCountries.ts's flag
  // list (no freely-licensed flag) — series derivation must not depend on
  // that list, or the exact series the feature was built for wouldn't group.
  it("works for a team excluded from the flag-country list (Afghanistan)", () => {
    const series = deriveSeriesKey("India", "Afghanistan", "India vs Afghanistan T20I series");
    expect(series).not.toBeNull();
    expect(series!.key).toContain("afghanistan");
  });

  it("returns null when no format can be detected (e.g. a franchise/league match)", () => {
    expect(deriveSeriesKey("Mumbai Indians", "Chennai Super Kings", "Mumbai Indians vs Chennai Super Kings, 12th Match")).toBeNull();
  });

  it("returns null for a degenerate same-team pairing", () => {
    expect(deriveSeriesKey("India", "India", "India vs India, 1st T20I")).toBeNull();
  });
});

describe("matchSeriesInTitle", () => {
  const active: ActiveSeries[] = [
    { key: "afghanistan-vs-india-t20i", label: "Afghanistan vs India • T20I", homeTeam: "India", awayTeam: "Afghanistan" },
  ];

  it("matches an editorial headline naming both teams", () => {
    expect(matchSeriesInTitle("India squad for Afghanistan T20I series 2026: Full list of players", active)).toEqual({
      key: "afghanistan-vs-india-t20i",
      label: "Afghanistan vs India • T20I",
    });
  });

  it("does not match a headline naming only one of the two teams", () => {
    expect(matchSeriesInTitle("Rahane urges team India to stick with Samson", active)).toBeNull();
  });

  it("does not match when there's no active series at all", () => {
    expect(matchSeriesInTitle("India vs Afghanistan preview", [])).toBeNull();
  });
});
