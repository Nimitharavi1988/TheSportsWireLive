/**
 * Config-driven ESPN league fetcher: one implementation for every league on
 * ESPN's public scoreboard API (site.api.espn.com), so a new league is a
 * config entry, not another copy of nflData.ts/nbaData.ts/nhlData.ts (which
 * predate this and still work the same way). Started 2026-09-26 with
 * college football and the WNBA — the two biggest US sports the site
 * didn't cover. Checked live that day: both scoreboards return the current
 * week with records, TV, venue; college football adds AP/CFP ranks
 * (curatedRank) and the WNBA playoff round + series status (notes/series).
 *
 * Same RawMatchItem shape and rules as the other ESPN fetchers: live games
 * keep matchStatus "scheduled" with the running score (the scoreboard and
 * liveRefresh.ts read state from matchClock/scores), finals are
 * "finished".
 */
import type { RawMatchItem } from "./footballData";
import { espnBroadcast, espnLiveClock, espnRecord, espnScore, type EspnClockStyle, type EspnStatus } from "../scores/espnStatus";

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  records?: { type?: string; summary?: string }[];
  curatedRank?: { current?: number };
  team: { id: string; displayName: string; location?: string; logo?: string };
}

export interface EspnLeagueEvent {
  id: string;
  date: string;
  status: EspnStatus;
  competitions: {
    competitors: EspnCompetitor[];
    venue?: { fullName: string; address?: { city?: string; state?: string } };
    broadcasts?: { names?: string[] }[];
    notes?: { headline?: string }[];
    series?: { summary?: string };
  }[];
}

export interface EspnLeagueConfig {
  /** ESPN API path, e.g. "football/college-football". */
  path: string;
  /** Stored as Article.sourceName — also the liveRefresh.ts key. */
  sourceName: string;
  category: string;
  leagueLabel: string;
  /** How the league is named in generated sentences ("in college football"). */
  inLeague: string;
  clockStyle: EspnClockStyle;
  /** "Kickoff" / "Tip-off". */
  startWord: string;
  /** espn.com game page segment, e.g. "college-football". */
  gamePath: string;
  dedupePrefix: string;
  /** Time zone for dates in titles/text. US leagues use Eastern: a 7:30 PM
   *  ET kickoff is 23:30 UTC, and a UTC date would name the wrong day for a
   *  late game (the older fetchers still write UTC dates). */
  timeZone: string;
  /** Show AP/CFP ranks (college). */
  ranked?: boolean;
}

export const COLLEGE_FOOTBALL: EspnLeagueConfig = {
  // Default scoreboard = this week's games involving a Top-25 team (18 on
  // 2026-09-26, vs 71 for all of FBS via groups=80) — the games a US
  // audience actually follows, without flooding the page with every FBS
  // matchup.
  path: "football/college-football",
  sourceName: "ESPN College Football",
  category: "college-football",
  leagueLabel: "College Football",
  inLeague: "college football",
  clockStyle: "quarters",
  startWord: "Kickoff",
  gamePath: "college-football",
  dedupePrefix: "espn-cfb",
  timeZone: "America/New_York",
  ranked: true,
};

export const WNBA: EspnLeagueConfig = {
  path: "basketball/wnba",
  sourceName: "ESPN WNBA",
  category: "wnba",
  leagueLabel: "WNBA",
  inLeague: "the WNBA",
  clockStyle: "quarters",
  startWord: "Tip-off",
  gamePath: "wnba",
  dedupePrefix: "espn-wnba",
  timeZone: "America/New_York",
};

export const ESPN_LEAGUES = [COLLEGE_FOOTBALL, WNBA];

// "No. 5 Indiana Hoosiers" for a ranked college team (ranks above 25 are
// ESPN's "unranked" 99).
function rankedName(competitor: EspnCompetitor, ranked: boolean | undefined): string {
  const rank = competitor.curatedRank?.current;
  return ranked && rank && rank <= 25 ? `No. ${rank} ${competitor.team.displayName}` : competitor.team.displayName;
}

// The small line under a scorecard: playoff round and series status
// ("First Round - Game 1 · Series starts 9/27"), bowl/title-game names, or
// the teams' ranks for a college game. Never a placeholder.
export function espnMatchNote(event: EspnLeagueEvent, config: EspnLeagueConfig): string | undefined {
  const competition = event.competitions?.[0];
  const parts: string[] = [];
  const headline = competition?.notes?.find((n) => n.headline)?.headline;
  if (headline) parts.push(headline);
  if (competition?.series?.summary) parts.push(competition.series.summary);
  if (parts.length === 0 && config.ranked) {
    const ranks = (competition?.competitors ?? [])
      .filter((c) => (c.curatedRank?.current ?? 99) <= 25)
      .map((c) => `No. ${c.curatedRank!.current} ${c.team.location ?? c.team.displayName}`);
    if (ranks.length > 0) parts.push(ranks.join(" · "));
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

// One scoreboard event -> the standard match item (pure, unit-tested).
export function espnEventToItem(event: EspnLeagueEvent, config: EspnLeagueConfig): RawMatchItem | null {
  const state = event.status?.type?.state;
  if (state !== "post" && state !== "pre" && state !== "in") return null;
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((c) => c.homeAway === "home");
  const away = competition?.competitors?.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const isFinal = state === "post";
  const isLive = state === "in";
  const homeTeam = home.team.displayName;
  const awayTeam = away.team.displayName;
  const homeRecord = espnRecord(home);
  const awayRecord = espnRecord(away);
  const context = [
    homeRecord ? ` ${homeTeam} are ${homeRecord} this season.` : "",
    awayRecord ? ` ${awayTeam} are ${awayRecord} this season.` : "",
  ].join("");
  const start = new Date(event.date);
  const venueInfo = competition?.venue;
  // ESPN sometimes already puts the city in the name ("Memorial Stadium
  // (Bloomington, IN)") — don't repeat it.
  const venue = venueInfo
    ? venueInfo.fullName.includes("(")
      ? venueInfo.fullName
      : [venueInfo.fullName, venueInfo.address?.city, venueInfo.address?.state].filter(Boolean).join(", ")
    : undefined;

  let title: string;
  let summary: string;
  let body: string;
  if (isFinal) {
    const hs = Number(home.score ?? 0);
    const as = Number(away.score ?? 0);
    const dateLabel = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: config.timeZone });
    const result = hs > as ? `${homeTeam} won ${hs}-${as}.` : as > hs ? `${awayTeam} won ${as}-${hs}.` : `The game finished ${hs}-${as}.`;
    title = `${homeTeam} ${hs}-${as} ${awayTeam}`;
    summary = `${homeTeam} played ${awayTeam} in ${config.inLeague}, finishing ${hs}-${as}.`;
    body = `${rankedName(home, config.ranked)} played ${rankedName(away, config.ranked)} in ${config.inLeague} on ${dateLabel}. ${result}${context}`;
  } else {
    const dateLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: config.timeZone });
    const startLabel = start.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: config.timeZone, timeZoneName: "short",
    });
    title = `Preview: ${homeTeam} vs ${awayTeam} — ${dateLabel}`;
    summary = `${homeTeam} face ${awayTeam} in ${config.inLeague} on ${dateLabel}.`;
    body = `${rankedName(home, config.ranked)} face ${rankedName(away, config.ranked)} in ${config.inLeague}. ${config.startWord} is ${startLabel}.${context}`;
  }

  return {
    title,
    summary,
    body,
    sourceUrl: `https://www.espn.com/${config.gamePath}/game/_/gameId/${event.id}`,
    sourceName: config.sourceName,
    category: config.category,
    publishedAt: start,
    homeCrestUrl: home.team.logo,
    awayCrestUrl: away.team.logo,
    homeTeam,
    awayTeam,
    homeScore: isFinal || isLive ? espnScore(home) : undefined,
    awayScore: isFinal || isLive ? espnScore(away) : undefined,
    matchStatus: isFinal ? "finished" : "scheduled",
    leagueLabel: config.leagueLabel,
    matchClock: espnLiveClock(config.clockStyle, event.status),
    // null clears a note ESPN has since dropped (e.g. a series summary).
    matchNote: espnMatchNote(event, config) ?? null,
    homeRecord,
    awayRecord,
    broadcast: espnBroadcast(competition),
    kickoffAt: start,
    dedupeKey: `${config.dedupePrefix}-${event.id}`,
    venue,
  };
}

export async function fetchEspnLeague(config: EspnLeagueConfig): Promise<RawMatchItem[]> {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.path}/scoreboard`);
    if (!res.ok) {
      console.error(`${config.sourceName} scoreboard fetch failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return ((data.events ?? []) as EspnLeagueEvent[]).flatMap((e) => espnEventToItem(e, config) ?? []);
  } catch (err) {
    console.error(`${config.sourceName} scoreboard fetch failed:`, err);
    return [];
  }
}

export const fetchCollegeFootballData = () => fetchEspnLeague(COLLEGE_FOOTBALL);
export const fetchWnbaData = () => fetchEspnLeague(WNBA);
