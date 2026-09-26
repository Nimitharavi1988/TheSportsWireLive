/**
 * Pulls match data for major domestic football leagues that our existing
 * football-data.org integration (footballData.ts) doesn't cover well —
 * BBC/Sky/ESPN's RSS feeds (rssFeeds.ts) skew heavily toward the Premier
 * League, leaving Bundesliga/Serie A/Ligue 1/MLS with almost no coverage
 * despite real audience reach.
 *
 * Same ESPN public scoreboard API as nflData.ts/mlbData.ts/nbaData.ts
 * (site.api.espn.com) — unofficial and undocumented, but no API key
 * required and confirmed working live (2026-09-16), including real venue
 * data (ESPN provides this for these leagues, unlike football-data.org on
 * our tier — see footballData.ts's RawMatchItem.venue comment).
 *
 * Same RawMatchItem shape as footballData.ts, reused directly.
 */
import type { RawMatchItem } from "./footballData";
import { espnBroadcast, espnLiveClock, espnRecord, espnScore, type EspnStatus } from "../scores/espnStatus";
import { espnFetch } from "../espnFetch";

// Indian Super League removed (2026-09-20, explicit request) — confirmed
// real audience breakdown is mostly USA with Sweden/Ireland second, India
// actually low despite this site's cricket-heavy coverage, so ISL was
// spending ingestion/commentary budget on a league with ~no relevance to
// who's actually reading. Frees the budget for the other four leagues,
// which map onto the real audience far better (MLS for the US directly,
// Bundesliga/Serie A/Ligue 1 for general European-football crossover).
const LEAGUES: { code: string; label: string }[] = [
  { code: "ger.1", label: "Bundesliga" },
  { code: "ita.1", label: "Serie A" },
  { code: "fra.1", label: "Ligue 1" },
  { code: "usa.1", label: "MLS" },
];

interface EspnTeam {
  id: string;
  displayName: string;
  logo?: string;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  score: string;
  records?: { type?: string; summary?: string }[];
  team: EspnTeam;
}

interface EspnVenue {
  fullName: string;
  address?: { city?: string; country?: string };
}

interface EspnEvent {
  id: string;
  date: string;
  status: EspnStatus;
  competitions: { competitors: EspnCompetitor[]; venue?: EspnVenue; broadcasts?: { names?: string[] }[] }[];
}

async function fetchLeague(league: { code: string; label: string }): Promise<RawMatchItem[]> {
  const res = await espnFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`
  ).catch((err) => {
    console.error(`ESPN ${league.label} scoreboard fetch failed:`, err);
    return null;
  });
  if (!res || !res.ok) {
    if (res) console.error(`ESPN ${league.label} scoreboard fetch failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: RawMatchItem[] = [];

  for (const event of (data.events ?? []) as EspnEvent[]) {
    // Only finished results and pre-game previews — an in-progress match
    // (state "in") would be a confusing partial snapshot by the time this
    // article is actually read. Same rule as nflData.ts.
    const state = event.status?.type?.state;
    // "in" (live) games are kept with the running score, still matchStatus
    // "scheduled" — same approach and reasoning as nflData.ts.
    if (state !== "post" && state !== "pre" && state !== "in") continue;
    const isFinal = state === "post";
    const isLive = state === "in";

    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const venueInfo = event.competitions?.[0]?.venue;
    const venue = venueInfo
      ? [venueInfo.fullName, venueInfo.address?.city, venueInfo.address?.country].filter(Boolean).join(", ")
      : undefined;

    const homeTeam = home.team.displayName;
    const awayTeam = away.team.displayName;

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
      summary = `${homeTeam} played ${awayTeam} in the ${league.label}, finishing ${homeScore}-${awayScore}.`;

      const resultSentence =
        Number(homeScore) > Number(awayScore) ? `${homeTeam} won ${homeScore}-${awayScore}.`
        : Number(awayScore) > Number(homeScore) ? `${awayTeam} won ${awayScore}-${homeScore}.`
        : `The match ended in a ${homeScore}-${awayScore} draw.`;
      body = `${homeTeam} played ${awayTeam} in the ${league.label} on ${fullDateLabel}. ${resultSentence}`;
    } else {
      const kickoff = new Date(event.date);
      const dateLabel = kickoff.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const kickoffLabel = kickoff.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
      });

      title = `Preview: ${homeTeam} vs ${awayTeam} — ${dateLabel}`;
      summary = `${homeTeam} face ${awayTeam} in the ${league.label} on ${dateLabel}.`;
      body = `${homeTeam} face ${awayTeam} in the ${league.label}. Kickoff is ${kickoffLabel}.`;
    }

    items.push({
      title,
      summary,
      body,
      sourceUrl: `https://www.espn.com/soccer/match/_/gameId/${event.id}`,
      sourceName: "ESPN Football",
      category: "football",
      publishedAt: new Date(event.date),
      homeCrestUrl: home.team.logo,
      awayCrestUrl: away.team.logo,
      homeTeam,
      awayTeam,
      homeScore: isFinal || isLive ? espnScore(home) : undefined,
      awayScore: isFinal || isLive ? espnScore(away) : undefined,
      matchStatus: isFinal ? "finished" : "scheduled",
      leagueLabel: league.label,
      matchClock: espnLiveClock("soccer", event.status),
      homeRecord: espnRecord(home),
      awayRecord: espnRecord(away),
      broadcast: espnBroadcast(event.competitions?.[0]),
      kickoffAt: new Date(event.date),
      // event.id is ESPN's own stable game identifier — same reasoning as
      // nflData.ts's dedupeKey.
      dedupeKey: `espn-soccer-${league.code}-${event.id}`,
      venue,
      // Real competition name for SportsEvent JSON-LD's organizer field
      // (article/[slug]/page.tsx) — deliberately NOT paired with a
      // seriesKey, since the /series/[seriesKey] grouping page is cricket-
      // specific infrastructure this doesn't need; organizer only reads
      // seriesLabel on its own.
      seriesLabel: league.label,
    });
  }

  return items;
}

export async function fetchDomesticFootballData(): Promise<RawMatchItem[]> {
  const results = await Promise.all(LEAGUES.map(fetchLeague));
  return results.flat();
}
