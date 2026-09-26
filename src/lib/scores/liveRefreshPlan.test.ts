import { describe, it, expect, vi } from "vitest";

// liveRefresh.ts imports the DB client, which needs a connection string
// just to load; the planner under test doesn't touch it.
vi.mock("@/db", () => ({ db: {} }));

import { itemsToRefresh, supersededToRefresh } from "./liveRefresh";
import { computeStableDedupeHash } from "../ingestion/dedupe";
import type { RawMatchItem } from "../ingestion/footballData";

const now = new Date("2026-09-27T19:00:00Z");

function game(id: string, kickoffIso: string, overrides: Partial<RawMatchItem> = {}): RawMatchItem {
  return {
    title: `Game ${id}`,
    summary: "",
    sourceUrl: "",
    sourceName: "ESPN NFL",
    category: "american-football",
    publishedAt: now,
    kickoffAt: new Date(kickoffIso),
    dedupeKey: `espn-nfl-${id}`,
    ...overrides,
  };
}

const existing = (entries: [string, string | null][]) =>
  new Map(entries.map(([id, status]) => [computeStableDedupeHash(`espn-nfl-${id}`), { id: `row-${id}`, matchStatus: status }]));

describe("itemsToRefresh", () => {
  it("picks started and about-to-start games we have that aren't final", () => {
    const items = [
      game("live", "2026-09-27T17:00:00Z"),
      game("soon", "2026-09-27T19:10:00Z"),
      game("later", "2026-09-27T20:25:00Z"),
      game("done", "2026-09-27T13:00:00Z"),
      game("unknown", "2026-09-27T17:00:00Z"),
    ];
    const picked = itemsToRefresh(
      items,
      existing([["live", "scheduled"], ["soon", "scheduled"], ["later", "scheduled"], ["done", "finished"]]),
      now
    ).map((p) => p.id);
    expect(picked).toEqual(["row-live", "row-soon"]);
  });

  it("passes the stored status through so the final-whistle text change happens once", () => {
    const [p] = itemsToRefresh([game("live", "2026-09-27T17:00:00Z", { matchStatus: "finished" })], existing([["live", "scheduled"]]), now);
    expect(p.existingMatchStatus).toBe("scheduled");
  });
});

describe("supersededToRefresh", () => {
  const espn = (home: string, away: string, kickoff: string): RawMatchItem => ({
    title: `${home} vs ${away}`, summary: "", body: "", sourceUrl: "", sourceName: "ESPN Cricket", category: "cricket",
    publishedAt: now, homeTeam: home, awayTeam: away, kickoffAt: new Date(kickoff), dedupeKey: `espn-cricket-${home}`,
  });

  it("pairs another provider's row with the item for the same match, in either team order", () => {
    const items = [espn("Glamorgan", "Essex", "2026-09-24T09:30:00Z"), espn("Kent", "Gloucestershire", "2026-09-24T09:30:00Z")];
    const rows = [
      { id: "a", matchKey: "cricket:2026-09-24:glamorgan-v-essex", homeTeam: "Glamorgan" },
      { id: "b", matchKey: "cricket:2026-09-24:gloucestershire-v-kent", homeTeam: "Gloucestershire" },
      { id: "c", matchKey: "cricket:2026-09-24:lancashire-v-durham", homeTeam: "Lancashire" },
    ];
    const out = supersededToRefresh(items, rows, now);
    expect(out.map((o) => [o.row.id, o.item.homeTeam])).toEqual([["a", "Glamorgan"], ["b", "Kent"]]);
  });

  it("ignores a match that hasn't reached its pre-start window", () => {
    const rows = [{ id: "a", matchKey: "cricket:2026-09-30:india-v-west-indies", homeTeam: "India" }];
    expect(supersededToRefresh([espn("India", "West Indies", "2026-09-30T08:30:00Z")], rows, now)).toEqual([]);
  });
});
