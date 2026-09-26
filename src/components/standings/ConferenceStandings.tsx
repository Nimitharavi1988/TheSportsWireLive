"use client";

import { useState } from "react";
import { ZONE_COLORS } from "@/lib/ingestion/standings";
import { StandingsCard, type StandingsColumn, type StandingsRow } from "./StandingsCard";

// Standings split into conferences/leagues (NFL, NBA, MLB, NHL): one
// StandingsCard with arrows to switch between them. The league-specific
// part — which columns, and how many teams make the playoffs — is config
// in the per-league wrappers (e.g. NhlStandingsCarousel.tsx).
export interface ConferenceGroup<T> {
  conferenceName: string;
  rows: T[];
}

const PLAYOFF_ZONE = { key: "playoff", label: "Playoff place", color: ZONE_COLORS.qualify };

export function ConferenceStandings<T>({
  conferences,
  columns,
  toRow,
  maxRows = 8,
  switchLabel = "conference",
}: {
  conferences: ConferenceGroup<T>[];
  columns: StandingsColumn[];
  // `playoff`: whether this team is currently in a playoff place.
  toRow: (row: T) => Omit<StandingsRow, "zone"> & { playoff: boolean };
  maxRows?: number;
  switchLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  if (conferences.length === 0) return null;
  const current = conferences[Math.min(index, conferences.length - 1)];
  const many = conferences.length > 1;
  const go = (delta: number) => setIndex((i) => (i + delta + conferences.length) % conferences.length);

  return (
    <StandingsCard
      title={current.conferenceName}
      groupLabel={many ? `${index + 1} of ${conferences.length}` : undefined}
      onPrev={many ? () => go(-1) : undefined}
      onNext={many ? () => go(1) : undefined}
      switchLabel={switchLabel}
      columns={columns}
      rows={current.rows.slice(0, maxRows).map((r) => {
        const { playoff, ...row } = toRow(r);
        return { ...row, zone: playoff ? PLAYOFF_ZONE.key : undefined };
      })}
      zones={[PLAYOFF_ZONE]}
    />
  );
}
