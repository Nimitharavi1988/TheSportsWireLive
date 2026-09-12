import { describe, it, expect } from "vitest";
import { deriveSeriesKey, detectSeriesFormat, detectSeriesFromTitle } from "./cricketSeries";

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

describe("detectSeriesFromTitle", () => {
  // Real example: this never came from CricketData.org's match-data feed at
  // all (confirmed live — that feed only reported CPL/County matches during
  // this series), so detection has to work from the title alone.
  it("detects a series purely from an editorial headline, no match-data required", () => {
    expect(detectSeriesFromTitle("India squad for Afghanistan T20I series 2026: Full list of players")).toEqual({
      key: "afghanistan-vs-india-t20i",
      label: "Afghanistan vs India • T20I",
    });
  });

  // The underlying series is real, caught live (2026-09-12): a genuine
  // England vs Pakistan Test never appeared in CricketData.org's feed at
  // all — this exact title is representative of that coverage.
  it("detects a real series CricketData.org never reported (England vs Pakistan)", () => {
    const result = detectSeriesFromTitle("Pakistan bat first as England toil on day four of the Test");
    expect(result).toEqual({ key: "england-vs-pakistan-test", label: "England vs Pakistan • Test" });
  });

  it("recognizes West Indies and Afghanistan, both excluded from the flag-country list", () => {
    expect(detectSeriesFromTitle("West Indies thrash Afghanistan in 2nd ODI")).toEqual({
      key: "afghanistan-vs-west-indies-odi",
      label: "Afghanistan vs West Indies • ODI",
    });
  });

  it("does not match a headline naming only one recognized team", () => {
    expect(detectSeriesFromTitle("Rahane urges team India to stick with Samson")).toBeNull();
  });

  it("does not match when no format word is present, even with two teams named", () => {
    expect(detectSeriesFromTitle("India and Australia both qualify for the next World Cup")).toBeNull();
  });

  it("does not match a purely domestic franchise headline", () => {
    expect(detectSeriesFromTitle("Guyana Amazon Warriors vs Trinbago Knight Riders, 33rd Match, CPL")).toBeNull();
  });
});
