import { describe, it, expect } from "vitest";
import { commentaryRunBudget, scaledReserve } from "./commentaryBudget";

describe("daily news write-up budget", () => {
  it("spreads the daily cap over the day's runs, with a little catch-up room", () => {
    // 400 a day over 96 runs: about 4 a run, up to 7 to catch up.
    expect(commentaryRunBudget(400, 0, 150)).toBe(7);
  });

  it("never goes past what's left of the day", () => {
    expect(commentaryRunBudget(400, 397, 150)).toBe(3);
    expect(commentaryRunBudget(400, 400, 150)).toBe(0);
    expect(commentaryRunBudget(400, 450, 150)).toBe(0);
  });

  it("never goes past the old per-run maximum", () => {
    expect(commentaryRunBudget(100000, 0, 150)).toBe(150);
  });

  it("scales the cricket and minor-sport floors to the run's budget", () => {
    expect(scaledReserve(35, 150, 7)).toBe(2);
    expect(scaledReserve(25, 150, 7)).toBe(1);
    expect(scaledReserve(35, 150, 0)).toBe(0);
    expect(scaledReserve(35, 150, 150)).toBe(35);
  });
});
