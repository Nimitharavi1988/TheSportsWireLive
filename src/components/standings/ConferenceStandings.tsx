"use client";

import { useState } from "react";
import { StandingsCard, type StandingsColumn, type StandingsRow } from "./StandingsCard";

// Standings split into conferences/leagues (NFL, NBA, MLB, NHL): one
// StandingsCard with arrows to switch between them. The league-specific
// part — which columns, and what counts as a playoff place — is just a
// config (see the per-league wrappers, e.g. NhlStandingsCarousel.tsx).
export interface ConferenceGroup<T> {
  conferenceName: string;
  rows: T[];
}

export function ConferenceStandings<T>({
  conferences,
  columns,
  toRow,
  maxRows = 7,
  legend = "Playoff seed",
  switchLabel = "conference",
}: {
  conferences: ConferenceGroup<T>[];
  columns: StandingsColumn[];
  toRow: (row: T) => StandingsRow;
  maxRows?: number;
  legend?: string;
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
      rows={current.rows.slice(0, maxRows).map(toRow)}
      legend={legend}
    />
  );
}
