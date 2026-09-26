"use client";

import type { MlbConferenceStandings } from "@/lib/ingestion/mlbData";
import { ConferenceStandings } from "./standings/ConferenceStandings";

// Mlb standings in the shared standings card (standings/StandingsCard.tsx).
// Playoff places: 6 per league.
const PLAYOFF_PLACES = 6;

export function MlbStandingsCarousel({ conferences }: { conferences: MlbConferenceStandings[] }) {
  return (
    <ConferenceStandings
      conferences={conferences}
      columns={[{ label: "W", strong: true }, { label: "L" }]}
      toRow={(row) => ({
        id: row.teamId,
        position: row.playoffSeed || "–",
        name: row.teamName,
        logo: row.teamLogo,
        values: [row.wins, row.losses],
        playoff: row.playoffSeed > 0 && row.playoffSeed <= PLAYOFF_PLACES,
      })}
      switchLabel="league"
    />
  );
}
