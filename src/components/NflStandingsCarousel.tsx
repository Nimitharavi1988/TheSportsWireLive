"use client";

import type { NflConferenceStandings } from "@/lib/ingestion/nflData";
import { ConferenceStandings } from "./standings/ConferenceStandings";

// Nfl standings in the shared standings card (standings/StandingsCard.tsx).
// Playoff places: 7 per conference.
const PLAYOFF_PLACES = 7;

export function NflStandingsCarousel({ conferences }: { conferences: NflConferenceStandings[] }) {
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
        qualified: row.playoffSeed > 0 && row.playoffSeed <= PLAYOFF_PLACES,
      })}
    />
  );
}
