import { describe, it, expect, vi } from "vitest";

// liveRefresh.ts imports the DB client, which needs a connection string
// just to load; the planner under test doesn't touch it.
vi.mock("@/db", () => ({ db: {} }));

import { itemsToRefresh } from "./liveRefresh";
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
