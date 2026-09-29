import { describe, it, expect } from "vitest";
import { dropRepeatedRows } from "./commentary";

const title = "Jalen Hurts injury update as Eagles QB leaves game after big hit vs Bears";
const hook = "Jalen Hurts exits game after big hit vs Bears";

describe("dropRepeatedRows", () => {
  it("drops rows that only restate the headline or hook", () => {
    const rows = [
      { label: "Player", value: "Jalen Hurts" },
      { label: "Team", value: "Philadelphia Eagles" },
      { label: "Replacement", value: "Backup Andy Dalton" },
      { label: "Status", value: "Medical evaluation" },
    ];
    expect(dropRepeatedRows(rows, title, hook).map((r) => r.label)).toEqual(["Replacement", "Status"]);
  });

  it("keeps rows with new numbers, names or results", () => {
    const rows = [
      { label: "Target Chased", value: "296 runs with eight overs left" },
      { label: "Top Scorer", value: "Virat Kohli 139 not out" },
      { label: "Opener", value: "Shubman Gill scored 110" },
    ];
    expect(dropRepeatedRows(rows, "India beat West Indies by eight wickets", "Kohli leads India to opening ODI victory")).toHaveLength(3);
  });
});
