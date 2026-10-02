import { describe, it, expect } from "vitest";
import { espnDay } from "./domesticFootballData";

describe("espnDay", () => {
  const now = new Date("2026-10-02T21:30:00Z");
  it("names a scoreboard day as YYYYMMDD in UTC, relative to now", () => {
    expect(espnDay(now, 0)).toBe("20261002");
    expect(espnDay(now, 1)).toBe("20261003");
    expect(espnDay(now, 2)).toBe("20261004");
    expect(espnDay(now, -1)).toBe("20261001");
  });
  it("rolls over month ends", () => {
    expect(espnDay(new Date("2026-10-31T12:00:00Z"), 1)).toBe("20261101");
  });
});
