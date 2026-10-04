import { describe, it, expect } from "vitest";
import { commentaryRunBudget, scaledReserve } from "./commentaryBudget";

describe("hourly news write-up budget", () => {
  it("gives a run up to half the hour's allowance when the hour is quiet", () => {
    // 400 a day = 17 an hour; one run takes at most 9 of them.
    expect(commentaryRunBudget(400, 0, 150)).toBe(9);
  });

  it("shares what's left of the hour", () => {
    expect(commentaryRunBudget(400, 10, 150)).toBe(7);
    expect(commentaryRunBudget(400, 16, 150)).toBe(1);
  });

  it("stops when the hour's allowance is used, including the first hour after a busy day", () => {
    expect(commentaryRunBudget(400, 17, 150)).toBe(0);
    expect(commentaryRunBudget(400, 156, 150)).toBe(0);
  });

  it("never goes past the old per-run maximum", () => {
    expect(commentaryRunBudget(100000, 0, 150)).toBe(150);
  });

  it("scales the cricket and minor-sport floors to the run's budget", () => {
    expect(scaledReserve(35, 150, 9)).toBe(2);
    expect(scaledReserve(25, 150, 9)).toBe(2);
    expect(scaledReserve(35, 150, 0)).toBe(0);
    expect(scaledReserve(35, 150, 150)).toBe(35);
  });
});
