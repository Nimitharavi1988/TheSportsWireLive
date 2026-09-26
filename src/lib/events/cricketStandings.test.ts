import { describe, it, expect } from "vitest";
import { parseCricketStandings } from "./cricketStandings";

// ESPN shape as returned live on 2026-09-26 (Asian Games men's cricket).
const stats = (m: string, w: string, l: string, nr: string, pt: string, nrr: string) =>
  [["M", m], ["W", w], ["L", l], ["N/R", nr], ["PT", pt], ["NRR", nrr]].map(([abbreviation, displayValue]) => ({ abbreviation, displayValue }));

describe("parseCricketStandings", () => {
  it("reads each group's table", () => {
    const groups = parseCricketStandings({
      children: [{ name: "Group A", standings: { entries: [
        { team: { id: "33", displayName: "Nepal" }, stats: stats("2", "1", "0", "1", "3", "0.842") },
        { team: { id: "40", displayName: "Afghanistan" }, stats: stats("2", "1", "1", "0", "2", "0.846") },
      ] } }, { name: "Group Z", standings: { entries: [] } }],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].rows[0]).toMatchObject({ team: "Nepal", played: "2", won: "1", noResult: "1", points: "3", nrr: "0.842" });
  });
});
