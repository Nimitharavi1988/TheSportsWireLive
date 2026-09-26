import { describe, it, expect } from "vitest";
import { mlbLiveClock } from "./mlbData";

// Linescore shapes as returned live by statsapi.mlb.com on 2026-09-26.
const live = (inningState: string, outs: number, detailedState = "In Progress") => ({
  status: { abstractGameState: "Live", detailedState },
  linescore: { currentInningOrdinal: "8th", inningState, outs },
});

describe("mlbLiveClock", () => {
  it("reads the inning and outs of a game in progress", () => {
    expect(mlbLiveClock(live("Top", 1))).toBe("Top 8th · 1 out");
    expect(mlbLiveClock(live("Bottom", 0))).toBe("Bot 8th · 0 out");
    expect(mlbLiveClock(live("End", 3))).toBe("End 8th");
    expect(mlbLiveClock(live("Middle", 3))).toBe("Mid 8th");
  });

  it("shows delays, and nothing for games not in progress", () => {
    expect(mlbLiveClock(live("Top", 1, "Delayed: Rain"))).toBe("Delayed");
    expect(mlbLiveClock({ status: { abstractGameState: "Final" }, linescore: { currentInningOrdinal: "9th", inningState: "Bottom" } })).toBeNull();
    expect(mlbLiveClock({ status: { abstractGameState: "Live", detailedState: "Warmup" } })).toBeNull();
  });
});
