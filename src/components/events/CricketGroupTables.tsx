"use client";

import { StandingsCard } from "@/components/standings/StandingsCard";
import type { CricketGroup } from "@/lib/events/cricketStandings";

// Cricket group tables (e.g. Asian Games men's cricket) in the shared
// standings design.
export function CricketGroupTables({ label, groups }: { label: string; groups: CricketGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <StandingsCard
          key={g.name}
          title={`${label} · ${g.name}`}
          switchLabel="group"
          columns={[{ label: "M" }, { label: "W" }, { label: "L" }, { label: "NR" }, { label: "Pts", strong: true }, { label: "NRR" }]}
          rows={g.rows.map((r, i) => ({
            id: r.teamId,
            position: i + 1,
            name: r.team,
            logo: r.logo,
            values: [r.played, r.won, r.lost, r.noResult, r.points, r.nrr],
          }))}
        />
      ))}
    </>
  );
}
