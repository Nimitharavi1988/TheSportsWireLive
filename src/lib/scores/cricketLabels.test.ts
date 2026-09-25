import { describe, it, expect } from "vitest";
import { cricketLeagueLabel, cricketTeamScore } from "./cricketLabels";

describe("cricketLeagueLabel", () => {
  it("takes the competition after the stage", () => {
    expect(cricketLeagueLabel("Kent vs Gloucestershire, 53rd Match, County Championship Division One 2026")).toBe("County Championship Division One 2026");
    expect(cricketLeagueLabel("India vs West Indies, 1st ODI, West Indies tour of India, 2026")).toBe("West Indies tour of India, 2026");
  });

  it("returns undefined when there is no competition part", () => {
    expect(cricketLeagueLabel("India vs West Indies")).toBeUndefined();
  });
});

describe("cricketTeamScore", () => {
  it("attributes two-name innings to the team without its own (real CricketData shapes)", () => {
    const warks = [
      { inning: "leicestershire Inning 1", r: 125, w: 10, o: 47 },
      { inning: "Warwickshire,Leicestershire Inning 1", r: 130, w: 4, o: 47 },
    ];
    expect(cricketTeamScore(warks, "Warwickshire", "Leicestershire")).toBe("130/4 (47)");
    expect(cricketTeamScore(warks, "Leicestershire", "Warwickshire")).toBe("125");

    const yorks = [
      { inning: "yorkshire Inning 1", r: 212, w: 10, o: 65.4 },
      { inning: "Yorkshire,Somerset Inning 1", r: 201, w: 10, o: 59.4 },
      { inning: "yorkshire Inning 2", r: 275, w: 10, o: 111 },
      { inning: "Yorkshire,Somerset Inning 2", r: 101, w: 10, o: 48.2 },
    ];
    expect(cricketTeamScore(yorks, "Yorkshire", "Somerset")).toBe("212 & 275");
    expect(cricketTeamScore(yorks, "Somerset", "Yorkshire")).toBe("201 & 101");
  });

  it("handles the usual one-name-per-team labels", () => {
    const odi = [
      { inning: "England Inning 1", r: 301, w: 7, o: 50 },
      { inning: "Sri Lanka Inning 1", r: 276, w: 10, o: 48.3 },
    ];
    expect(cricketTeamScore(odi, "England", "Sri Lanka")).toBe("301/7 (50)");
    expect(cricketTeamScore(odi, "Sri Lanka", "England")).toBe("276");
  });

  it("returns undefined when it can't attribute an innings", () => {
    expect(cricketTeamScore([{ inning: "India,West Indies Inning 1", r: 10, w: 0, o: 2 }], "India", "West Indies")).toBeUndefined();
    expect(cricketTeamScore(undefined, "India", "West Indies")).toBeUndefined();
  });
});
