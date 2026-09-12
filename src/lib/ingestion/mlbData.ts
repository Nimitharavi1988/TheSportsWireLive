/**
 * Pulls MLB match data from the official MLB Stats API (statsapi.mlb.com) —
 * genuinely public and free, no API key required, confirmed working
 * directly (2026-09-12). Unlike football-data.org/CricketData.org, this is
 * MLB's own official data, not a third-party aggregator, so no daily
 * request cap to self-throttle against.
 *
 * Same RawMatchItem shape as footballData.ts/nflData.ts, reused directly.
 */
import type { RawMatchItem } from "./footballData";

const SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule";

// Static per-team logo CDN — MLB's own, confirmed working directly
// (2026-09-12): https://www.mlbstatic.com/team-logos/{teamId}.svg
function teamLogo(teamId: number): string {
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}

interface MlbTeamRef {
  team: { id: number; name: string };
  score?: number;
  leagueRecord?: { wins: number; losses: number };
}

interface MlbGame {
  gamePk: number;
  gameDate: string;
  status: { abstractGameState: string };
  teams: { home: MlbTeamRef; away: MlbTeamRef };
  venue?: { name: string };
}

function recordContext(teamName: string, record: MlbTeamRef["leagueRecord"]): string {
  if (!record) return "";
  return ` ${teamName} are ${record.wins}-${record.losses}.`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function fetchMlbData(): Promise<RawMatchItem[]> {
  const now = new Date();
  const startDate = isoDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const endDate = isoDate(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));

  let res: Response;
  try {
    res = await fetch(`${SCHEDULE_URL}?sportId=1&startDate=${startDate}&endDate=${endDate}`);
  } catch (err) {
    console.error("MLB Stats API fetch failed (network error):", err);
    return [];
  }
  if (!res.ok) {
    console.error(`MLB Stats API fetch failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: RawMatchItem[] = [];

  for (const dateEntry of data.dates ?? []) {
    for (const game of (dateEntry.games ?? []) as MlbGame[]) {
      // Only finished results and pre-game previews — an in-progress game
      // would just be a confusing partial snapshot by the time this
      // article is actually read (same reasoning as nflData.ts).
      const state = game.status?.abstractGameState;
      if (state !== "Final" && state !== "Preview") continue;

      const { home, away } = game.teams;
      const homeTeam = home.team.name;
      const awayTeam = away.team.name;
      const context = recordContext(homeTeam, home.leagueRecord) + recordContext(awayTeam, away.leagueRecord);

      let title: string;
      let summary: string;
      let body: string;

      if (state === "Final") {
        const homeScore = home.score ?? 0;
        const awayScore = away.score ?? 0;
        const fullDateLabel = new Date(game.gameDate).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric", year: "numeric",
        });

        title = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;
        summary = `${homeTeam} played ${awayTeam} in MLB, finishing ${homeScore}-${awayScore}.`;

        const resultSentence =
          homeScore > awayScore ? `${homeTeam} won ${homeScore}-${awayScore}.`
          : awayScore > homeScore ? `${awayTeam} won ${awayScore}-${homeScore}.`
          : `The game ended ${homeScore}-${awayScore}.`;
        body = `${homeTeam} played ${awayTeam} in MLB on ${fullDateLabel}${game.venue ? ` at ${game.venue.name}` : ""}. ${resultSentence}${context}`;
      } else {
        const firstPitch = new Date(game.gameDate);
        const dateLabel = firstPitch.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const firstPitchLabel = firstPitch.toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
        });

        title = `Preview: ${homeTeam} vs ${awayTeam} — ${dateLabel}`;
        summary = `${homeTeam} face ${awayTeam} in MLB on ${dateLabel}.`;
        body = `${homeTeam} face ${awayTeam} in MLB. First pitch is ${firstPitchLabel}.${context}`;
      }

      items.push({
        title,
        summary,
        body,
        sourceUrl: `https://www.mlb.com/gameday/${game.gamePk}`,
        sourceName: "MLB Stats API",
        category: "baseball",
        publishedAt: new Date(game.gameDate),
        homeCrestUrl: teamLogo(home.team.id),
        awayCrestUrl: teamLogo(away.team.id),
        homeTeam,
        awayTeam,
        homeScore: state === "Final" ? home.score : undefined,
        awayScore: state === "Final" ? away.score : undefined,
        matchStatus: state === "Final" ? "finished" : "scheduled",
        kickoffAt: new Date(game.gameDate),
        // gamePk is MLB's own stable game identifier — unlike the title
        // (which embeds a date), it never changes for a given game.
        dedupeKey: `mlb-${game.gamePk}`,
      });
    }
  }

  return items;
}
