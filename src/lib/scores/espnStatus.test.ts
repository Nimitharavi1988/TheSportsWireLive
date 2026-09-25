import { describe, it, expect } from "vitest";
import { espnBroadcast, espnLiveClock, espnRecord, espnScore, espnState } from "./espnStatus";
import { buildMatchKey } from "./matchKey";

const live = (name: string, period: number, displayClock: string) => ({ period, displayClock, type: { state: "in", name } });

describe("espnLiveClock", () => {
  it("formats NFL/NBA quarters and overtime", () => {
    expect(espnLiveClock("quarters", live("STATUS_IN_PROGRESS", 3, "8:42"))).toBe("Q3 · 8:42");
    expect(espnLiveClock("quarters", live("STATUS_IN_PROGRESS", 5, "3:12"))).toBe("OT · 3:12");
    expect(espnLiveClock("quarters", live("STATUS_IN_PROGRESS", 6, "1:00"))).toBe("2OT · 1:00");
    expect(espnLiveClock("quarters", live("STATUS_END_PERIOD", 1, "0:00"))).toBe("End of Q1");
    expect(espnLiveClock("quarters", live("STATUS_HALFTIME", 2, "0:00"))).toBe("Halftime");
  });

  it("formats hockey periods and soccer minutes", () => {
    expect(espnLiveClock("hockey", live("STATUS_IN_PROGRESS", 2, "11:05"))).toBe("P2 · 11:05");
    expect(espnLiveClock("hockey", live("STATUS_IN_PROGRESS", 4, "2:30"))).toBe("OT · 2:30");
    // Real ESPN shape for a shootout (CGY @ SEA, 2026-09-25).
    expect(espnLiveClock("hockey", { period: 5, displayClock: "0:00", type: { state: "in", name: "STATUS_IN_PROGRESS", shortDetail: "In SO" } })).toBe("Shootout");
    // Playoff double overtime has no "SO", so it stays an overtime label.
    expect(espnLiveClock("hockey", { period: 5, displayClock: "12:10", type: { state: "in", name: "STATUS_IN_PROGRESS", shortDetail: "12:10 - 2OT" } })).toBe("2OT · 12:10");
    expect(espnLiveClock("soccer", live("STATUS_FIRST_HALF", 1, "67'"))).toBe("67'");
    expect(espnLiveClock("soccer", live("STATUS_HALFTIME", 1, "45'"))).toBe("HT");
    expect(espnLiveClock("sets", live("STATUS_IN_PROGRESS", 3, "0:00"))).toBe("Set 3");
  });

  it("returns null for games not in progress (real ESPN shapes)", () => {
    const pre = { clock: 0, displayClock: "0:00", period: 0, type: { name: "STATUS_SCHEDULED", state: "pre", shortDetail: "9/27 - 1:00 PM EDT" } };
    const post = { clock: 0, displayClock: "0:00", period: 4, type: { name: "STATUS_FINAL", state: "post", shortDetail: "Final" } };
    expect(espnLiveClock("quarters", pre)).toBeNull();
    expect(espnLiveClock("quarters", post)).toBeNull();
    expect(espnState(post)).toBe("post");
    expect(espnState({ type: { state: "weird" } })).toBeNull();
  });
});

describe("espn competitor fields", () => {
  it("reads scores defensively", () => {
    expect(espnScore({ score: "24" })).toBe(24);
    expect(espnScore({ score: "" })).toBeUndefined();
    expect(espnScore({ score: "abc" })).toBeUndefined();
    expect(espnScore({})).toBeUndefined();
  });

  it("reads the overall record and the national broadcast", () => {
    const records = [
      { name: "overall", type: "total", summary: "2-0" },
      { name: "Home", type: "home", summary: "1-0" },
    ];
    expect(espnRecord({ records })).toBe("2-0");
    expect(espnRecord({ records: [] })).toBeUndefined();
    expect(espnBroadcast({ broadcasts: [{ names: ["FOX"] }] })).toBe("FOX");
    expect(espnBroadcast({ broadcasts: [] })).toBeUndefined();
  });
});

describe("buildMatchKey", () => {
  it("builds a provider-independent key", () => {
    expect(buildMatchKey("american-football", new Date("2026-09-27T17:00:00Z"), "Buffalo Bills", "Los Angeles Chargers")).toBe(
      "american-football:2026-09-27:buffalo-bills-v-los-angeles-chargers"
    );
    expect(buildMatchKey("football/world-cup", new Date("2026-07-01T18:00:00Z"), "Côte d'Ivoire", "Brighton & Hove Albion")).toBe(
      "football:2026-07-01:cote-d-ivoire-v-brighton-and-hove-albion"
    );
  });

  it("returns undefined without teams or a valid date", () => {
    expect(buildMatchKey("cricket", undefined, "India", "West Indies")).toBeUndefined();
    expect(buildMatchKey("cricket", new Date("2026-09-27"), undefined, "West Indies")).toBeUndefined();
    expect(buildMatchKey("cricket", new Date("invalid"), "India", "West Indies")).toBeUndefined();
  });
});
