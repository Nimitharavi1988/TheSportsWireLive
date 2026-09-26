"use client";

import type { NbaConferenceStandings } from "@/lib/ingestion/nbaData";
import { ConferenceStandings } from "./standings/ConferenceStandings";

// Nba standings in the shared standings card (standings/StandingsCard.tsx).
// Playoff places: the top 6 per conference qualify directly (7-10 go to the play-in).
const PLAYOFF_PLACES = 6;

export function NbaStandingsCarousel({ conferences }: { conferences: NbaConferenceStandings[] }) {
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
    />
  );
}
