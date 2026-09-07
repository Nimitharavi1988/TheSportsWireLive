/**
 * League table standings from football-data.org — real, factual, public
 * sports data (not copyrighted prose), used to give match articles genuine
 * analytical depth (league position, form, goal difference) instead of just
 * restating the final score.
 */

const BASE_URL = "https://api.football-data.org/v4";

// The domestic leagues covered by football-data.org's free tier that actually
// have a league table (knockout-only competitions like the Champions League,
// World Cup, and Euros don't — confirmed via direct API testing).
export const STANDINGS_LEAGUES = [
  { code: "PL", name: "Premier League" },
  { code: "ELC", name: "Championship" },
  { code: "PD", name: "La Liga" },
  { code: "SA", name: "Serie A" },
  { code: "BL1", name: "Bundesliga" },
  { code: "FL1", name: "Ligue 1" },
  { code: "PPL", name: "Primeira Liga" },
  { code: "DED", name: "Eredivisie" },
  { code: "BSA", name: "Brasileirão" },
];

export interface TeamStanding {
  position: number;
  points: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export async function fetchStandings(
  apiKey: string,
  competitionCode: string
): Promise<Map<number, TeamStanding>> {
  const map = new Map<number, TeamStanding>();

  try {
    const res = await fetch(`${BASE_URL}/competitions/${competitionCode}/standings`, {
      headers: { "X-Auth-Token": apiKey },
    });

    if (!res.ok) {
      // Not every competition has a league table (e.g. knockout-only stages) —
      // that's expected, not an error worth surfacing.
      return map;
    }

    const data = await res.json();
    for (const standing of data.standings ?? []) {
      if (standing.type !== "TOTAL") continue; // skip home/away-only splits
      for (const row of standing.table ?? []) {
        if (!row.team?.id) continue;
        map.set(row.team.id, {
          position: row.position,
          points: row.points,
          playedGames: row.playedGames,
          won: row.won,
          draw: row.draw,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
        });
      }
    }
  } catch (err) {
    console.error(`Standings fetch failed for ${competitionCode}:`, err);
  }

  return map;
}

export interface StandingsTableRow extends TeamStanding {
  teamId: number;
  teamName: string;
  teamCrest: string | null;
}

export interface StandingsTable {
  competitionName: string;
  rows: StandingsTableRow[];
}

/**
 * Full standings table with team names/crests, for direct display (the
 * homepage widget and the /standings detail page) — as opposed to
 * fetchStandings' Map-by-team-id, which is built for match-enrichment
 * lookups and deliberately doesn't carry team name/crest.
 */
export async function fetchStandingsTable(
  apiKey: string,
  competitionCode: string
): Promise<StandingsTable | null> {
  try {
    // Called from every homepage/article/player/club page render with no
    // caching, this was hitting the free tier's 10 requests/minute limit
    // almost immediately under normal browsing — the widget would then
    // silently render nothing (see the `!res.ok` branch below). Next.js's
    // Data Cache reuses this response across all renders for 5 minutes,
    // cutting real API calls from "once per page view" to "once per
    // competition per 5 minutes" site-wide.
    const res = await fetch(`${BASE_URL}/competitions/${competitionCode}/standings`, {
      headers: { "X-Auth-Token": apiKey },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const table = data.standings?.find((s: any) => s.type === "TOTAL")?.table ?? [];

    return {
      competitionName: data.competition?.name ?? competitionCode,
      rows: table.map((row: any) => ({
        teamId: row.team?.id,
        teamName: row.team?.name ?? "Unknown",
        teamCrest: row.team?.crest ?? null,
        position: row.position,
        points: row.points,
        playedGames: row.playedGames,
        won: row.won,
        draw: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
      })),
    };
  } catch (err) {
    console.error(`Standings table fetch failed for ${competitionCode}:`, err);
    return null;
  }
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
