import { describe, it, expect } from "vitest";
import { cricketLeagueLabel } from "./cricketLabels";

describe("cricketLeagueLabel", () => {
  it("takes the competition after the stage", () => {
    expect(cricketLeagueLabel("Kent vs Gloucestershire, 53rd Match, County Championship Division One 2026")).toBe("County Championship Division One 2026");
    expect(cricketLeagueLabel("India vs West Indies, 1st ODI, West Indies tour of India, 2026")).toBe("West Indies tour of India, 2026");
  });

  it("returns undefined when there is no competition part", () => {
    expect(cricketLeagueLabel("India vs West Indies")).toBeUndefined();
  });
});
