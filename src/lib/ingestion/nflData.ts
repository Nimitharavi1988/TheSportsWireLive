/**
 * Pulls NFL match data from ESPN's public scoreboard/standings JSON API
 * (site.api.espn.com). Unofficial and undocumented — ESPN doesn't publish
 * or support it, so it could change or get rate-limited without notice —
 * but no API key is required, confirmed working directly (2026-09-10), and
 * this exact endpoint shape has been stable and widely used by developers
 * for years (unlike, for example, Reddit's recently-locked-down endpoint).
 *
 * Same RawMatchItem shape as footballData.ts, reused directly rather than
 * duplicated.
 */
import { ordinal } from "./standings";
import type { RawMatchItem } from "./footballData";

const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/football/nfl/standings";

interface EspnTeam {
  id: string;
  displayName: string;
  logo?: string;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  score: string;
  team: EspnTeam;
}

interface EspnEvent {
  id: string;
  date: string;
  status: { type: { state: string; completed: boolean } };
  competitions: { competitors: EspnCompetitor[] }[];
}

interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
  playoffSeed: number;
  conferenceName: string;
}

// Standings give each match real analytical depth (season record, playoff
// seed) instead of just restating the score — same reasoning as
// standings.ts's use for football. Conference standings here are already
// flat (32 teams total across the two conferences, no further division
// nesting in this endpoint), so no recursion needed.
async function fetchTeamRecords(): Promise<Map<string, TeamRecord>> {
  try {
    const res = await fetch(`${STANDINGS_URL}?season=${new Date().getFullYear()}`);
    if (!res.ok) {
      console.error(`ESPN NFL standings fetch failed: ${res.status}`);
      return new Map();
    }
    const data = await res.json();
    const records = new Map<string, TeamRecord>();
    for (const conference of data.children ?? []) {
      for (const entry of conference.standings?.entries ?? []) {
        const stat = (name: string) =>
          Number(entry.stats?.find((s: { name: string }) => s.name === name)?.displayValue ?? 0);
        records.set(entry.team?.id, {
          wins: stat("wins"),
          losses: stat("losses"),
          ties: stat("ties"),
          playoffSeed: stat("playoffSeed"),
          conferenceName: conference.name ?? "",
        });
      }
    }
    return records;
  } catch (err) {
    console.error("ESPN NFL standings fetch failed:", err);
    return new Map();
  }
}

function recordContext(teamName: string, record: TeamRecord | undefined): string {
  if (!record) return "";
  const recordStr = record.ties > 0 ? `${record.wins}-${record.losses}-${record.ties}` : `${record.wins}-${record.losses}`;
  const seedText = record.playoffSeed > 0 ? `, seeded ${ordinal(record.playoffSeed)} in the ${record.conferenceName}` : "";
  return ` ${teamName} are ${recordStr}${seedText}.`;
}

export async function fetchNflData(): Promise<RawMatchItem[]> {
  const [scoreboardRes, teamRecords] = await Promise.all([
    fetch(SCOREBOARD_URL).catch((err) => {
      console.error("ESPN NFL scoreboard fetch failed:", err);
      return null;
    }),
    fetchTeamRecords(),
  ]);

  if (!scoreboardRes || !scoreboardRes.ok) {
    if (scoreboardRes) console.error(`ESPN NFL scoreboard fetch failed: ${scoreboardRes.status}`);
    return [];
  }

  const data = await scoreboardRes.json();
  const items: RawMatchItem[] = [];

  for (const event of (data.events ?? []) as EspnEvent[]) {
    // Only finished results and pre-game previews — an in-progress game
    // (state "in": live, halftime, etc.) would just be a confusing partial
    // snapshot by the time this article is actually read.
    const state = event.status?.type?.state;
    if (state !== "post" && state !== "pre") continue;

    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeTeam = home.team.displayName;
    const awayTeam = away.team.displayName;
    const context = recordContext(homeTeam, teamRecords.get(home.team.id)) + recordContext(awayTeam, teamRecords.get(away.team.id));

    let title: string;
    let summary: string;
    let body: string;

    if (state === "post") {
      const homeScore = home.score;
      const awayScore = away.score;
      const fullDateLabel = new Date(event.date).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });

      title = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;
      summary = `${homeTeam} played ${awayTeam} in the NFL, finishing ${homeScore}-${awayScore}.`;

      const resultSentence =
        Number(homeScore) > Number(awayScore) ? `${homeTeam} won ${homeScore}-${awayScore}.`
        : Number(awayScore) > Number(homeScore) ? `${awayTeam} won ${awayScore}-${homeScore}.`
        : `The game ended in a ${homeScore}-${awayScore} tie.`;
      body = `${homeTeam} played ${awayTeam} in the NFL on ${fullDateLabel}. ${resultSentence}${context}`;
    } else {
      const kickoff = new Date(event.date);
      const dateLabel = kickoff.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const kickoffLabel = kickoff.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
      });

      title = `Preview: ${homeTeam} vs ${awayTeam} — ${dateLabel}`;
      summary = `${homeTeam} face ${awayTeam} in the NFL on ${dateLabel}.`;
      body = `${homeTeam} face ${awayTeam} in the NFL. Kickoff is ${kickoffLabel}.${context}`;
    }

    items.push({
      title,
      summary,
      body,
      sourceUrl: `https://www.espn.com/nfl/game/_/gameId/${event.id}`,
      sourceName: "ESPN NFL",
      category: "american-football",
      publishedAt: new Date(event.date),
      homeCrestUrl: home.team.logo,
      awayCrestUrl: away.team.logo,
      homeTeam,
      awayTeam,
      homeScore: state === "post" ? Number(home.score) : undefined,
      awayScore: state === "post" ? Number(away.score) : undefined,
      matchStatus: state === "post" ? "finished" : "scheduled",
      kickoffAt: new Date(event.date),
      // event.id is ESPN's own stable game identifier — unlike the title
      // (which embeds a kickoff date ESPN can revise as broadcast slots get
      // finalized), it never changes for a given game, so dedup keyed on it
      // can't be fooled by a schedule-time update. See dedupe.ts.
      dedupeKey: `espn-nfl-${event.id}`,
    });
  }

  return items;
}
