"use client";

import type { NhlConferenceStandings } from "@/lib/ingestion/nhlData";
import { ConferenceStandings } from "./standings/ConferenceStandings";

// Nhl standings in the shared standings card (standings/StandingsCard.tsx).
// Playoff places: 8 per conference. Ranked by points (an OT/shootout loss earns one).
const PLAYOFF_PLACES = 8;

export function NhlStandingsCarousel({ conferences }: { conferences: NhlConferenceStandings[] }) {
  return (
    <ConferenceStandings
      conferences={conferences}
      columns={[{ label: "W" }, { label: "L" }, { label: "OTL" }, { label: "PTS", strong: true }]}
      toRow={(row) => ({
        id: row.teamId,
        position: row.playoffSeed || "–",
        name: row.teamName,
        logo: row.teamLogo,
        values: [row.wins, row.losses, row.otLosses, row.points],
        qualified: row.playoffSeed > 0 && row.playoffSeed <= PLAYOFF_PLACES,
      })}
    />
  );
}
