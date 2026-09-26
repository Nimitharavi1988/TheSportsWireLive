"use client";

import type { StandingsTableRow } from "@/lib/ingestion/standings";
import { LEAGUE_ZONES, zoneFor } from "@/lib/ingestion/standings";
import { StandingsCard, type StandingsColumn } from "./standings/StandingsCard";

// Football league table rows -> StandingsCard, with the league's own zones
// (standings.ts LEAGUE_ZONES). Shared by the sidebar widget (compact: the
// top of the table) and the full /standings/[code] page.

export const COMPACT_COLUMNS: StandingsColumn[] = [
  { label: "MP" }, { label: "W" }, { label: "D" }, { label: "L" }, { label: "GD" }, { label: "Pts", strong: true },
];
const FULL_COLUMNS: StandingsColumn[] = [
  { label: "MP" }, { label: "W" }, { label: "D" }, { label: "L" }, { label: "GF" }, { label: "GA" }, { label: "GD" }, { label: "Pts", strong: true },
];

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

// Zones are worked out against the whole table (relegation counts from the
// last place), so map every row first and slice afterwards.
export function footballRows(code: string, rows: StandingsTableRow[], full: boolean) {
  return rows.map((row) => ({
    id: String(row.teamId),
    position: row.position,
    name: row.teamName,
    logo: row.teamCrest,
    values: full
      ? [row.playedGames, row.won, row.draw, row.lost, row.goalsFor, row.goalsAgainst, signed(row.goalDifference), row.points]
      : [row.playedGames, row.won, row.draw, row.lost, signed(row.goalDifference), row.points],
    zone: zoneFor(code, row.position, rows.length)?.key,
  }));
}

export function footballZones(code: string) {
  return (LEAGUE_ZONES[code] ?? []).map(({ key, label, color }) => ({ key, label, color }));
}

// The whole table, for /standings/[code].
export function FullStandingsTable({ code, title, rows }: { code: string; title: string; rows: StandingsTableRow[] }) {
  return (
    <StandingsCard
      title={title}
      switchLabel="league"
      columns={FULL_COLUMNS}
      rows={footballRows(code, rows, true)}
      zones={footballZones(code)}
      full
    />
  );
}
