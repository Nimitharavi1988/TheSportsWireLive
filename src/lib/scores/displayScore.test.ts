import { describe, it, expect } from "vitest";
import { splitScore } from "./displayScore";

describe("splitScore", () => {
  it("moves overs and target to the detail line", () => {
    expect(splitScore("322/9 (50 ov)")).toEqual({ main: "322/9", detail: "50 ov" });
    expect(splitScore("145/4 (28 ov, target 191)")).toEqual({ main: "145/4", detail: "28 ov, target 191" });
    expect(splitScore("364 & 134/2 (27.5 ov)")).toEqual({ main: "364 & 134/2", detail: "27.5 ov" });
  });
  it("leaves plain scores alone", () => {
    expect(splitScore("24")).toEqual({ main: "24", detail: null });
    expect(splitScore(null)).toEqual({ main: "", detail: null });
  });
});
