/**
 * Pulls match data from football-data.org's free tier — all 12 competitions
 * included in the free plan, both finished results and upcoming fixtures
 * (previews). Includes retry-with-backoff if the free tier's rate limit
 * (10 requests/minute) gets hit.
 *
 * Docs: https://www.football-data.org/documentation/quickstart
 */

import { fetchStandings, ordinal, type TeamStanding } from "./standings";

const BASE_URL = "https://api.football-data.org/v4";

const COMPETITIONS = [
  "PL", "ELC", "BL1", "DED", "BSA", "PD", "FL1", "SA", "PPL", "CL", "EC", "WC",
];

// Cloudflare Workers Free caps each invocation at 50 outbound subrequests
// (hard platform limit, not configurable without the paid plan — see
// https://developers.cloudflare.com/workers/wrangler/configuration/#limits).
// All 12 competitions x 3 calls each (standings + finished + scheduled) is
// 36 subrequests on its own, before RSS/cricket/trending/Gemini/Wikimedia/DB
// even run — reliably over the cap by itself. Sharding into 3 rotating
// groups of 4 keeps each run's football-data.org footprint to ~12 typical
// (comfortably under budget alongside everything else), at the cost of a
// full 12-competition sweep taking ~3 runs (~90 min at the current 30-min
// cron interval) to complete instead of every single run. Deterministic on
// wall-clock time rather than persisted state, since a Workers invocation
// can't reliably assume the same isolate (and its in-memory state) handles
// the next run.
const SHARD_COUNT = 3;
const SHARD_INTERVAL_MS = 30 * 60 * 1000; // matches the cron schedule

function currentShard(): string[] {
  const shardIndex = Math.floor(Date.now() / SHARD_INTERVAL_MS) % SHARD_COUNT;
  return COMPETITIONS.filter((_, i) => i % SHARD_COUNT === shardIndex);
}

// Stay well under the free tier's 10 requests/minute limit.
const REQUEST_DELAY_MS = 7000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function categoryFor(code: string): string {
  if (code === "WC") return "football/world-cup";
  if (code === "EC") return "football/euros";
  return "football";
}

function dateRange() {
  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);
  const twoWeeksAhead = new Date(today);
  twoWeeksAhead.setDate(today.getDate() + 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    dateFromPast: fmt(twoWeeksAgo),
    dateToPast: fmt(today),
    dateFromFuture: fmt(today),
    dateToFuture: fmt(twoWeeksAhead),
  };
}

export interface RawMatchItem {
  title: string;
  summary: string;
  body?: string;
  sourceSnippet?: string;
  sourceUrl: string;
  sourceName: string;
  category: string;
  publishedAt: Date;
  homeCrestUrl?: string;
  awayCrestUrl?: string;
  // A real, story-specific photo carried directly in the publisher's own RSS
  // feed (media:thumbnail / media:content) — see rssFeeds.ts. Takes priority
  // over both the Wikimedia person-photo lookup and the generic stock-photo
  // fallback in runIngest.ts, since it's the most specific image available.
  heroImageUrl?: string;
  heroImageCredit?: string;
}

function standingsContext(
  homeTeam: string,
  awayTeam: string,
  homeTeamId: number | undefined,
  awayTeamId: number | undefined,
  standings: Map<number, TeamStanding>
): string {
  const home = homeTeamId ? standings.get(homeTeamId) : undefined;
  const away = awayTeamId ? standings.get(awayTeamId) : undefined;
  if (!home || !away) return "";

  return ` ${homeTeam} sit ${ordinal(home.position)} in the table with ${home.points} points from ${home.playedGames} games (${home.won}W ${home.draw}D ${home.lost}L), while ${awayTeam} are ${ordinal(away.position)} with ${away.points} points from ${away.playedGames} games (${away.won}W ${away.draw}D ${away.lost}L).`;
}

async function fetchCompetitionMatches(
  apiKey: string,
  competitionCode: string,
  status: "FINISHED" | "SCHEDULED",
  dateFrom: string,
  dateTo: string,
  standings: Map<number, TeamStanding>,
  attempt = 1
): Promise<RawMatchItem[]> {
  const res = await fetch(
    `${BASE_URL}/competitions/${competitionCode}/matches?status=${status}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    { headers: { "X-Auth-Token": apiKey } }
  );

  if (res.status === 429 && attempt < 3) {
    const backoffMs = 20000 * attempt; // 20s, then 40s
    console.warn(`Rate limited on ${competitionCode} (${status}), waiting ${backoffMs / 1000}s before retry ${attempt + 1}/3`);
    await sleep(backoffMs);
    return fetchCompetitionMatches(apiKey, competitionCode, status, dateFrom, dateTo, standings, attempt + 1);
  }

  if (!res.ok) {
    console.error(`football-data.org fetch failed for ${competitionCode} (${status}): ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: RawMatchItem[] = [];

  for (const match of data.matches ?? []) {
    const homeTeam = match.homeTeam?.name ?? "Home";
    const awayTeam = match.awayTeam?.name ?? "Away";
    const competitionName = match.competition?.name ?? "match";
    const homeCrestUrl = match.homeTeam?.crest || undefined;
    const awayCrestUrl = match.awayTeam?.crest || undefined;
    const context = standingsContext(homeTeam, awayTeam, match.homeTeam?.id, match.awayTeam?.id, standings);

    let title: string;
    let summary: string;
    let body: string;

    if (status === "FINISHED") {
      const homeScore = match.score?.fullTime?.home;
      const awayScore = match.score?.fullTime?.away;
      const fullDateLabel = new Date(match.utcDate).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });

      title = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;
      summary = `${homeTeam} played ${awayTeam} in the ${competitionName}, finishing ${homeScore}-${awayScore}.`;

      const resultSentence =
        homeScore > awayScore ? `${homeTeam} won ${homeScore}-${awayScore}.`
        : awayScore > homeScore ? `${awayTeam} won ${awayScore}-${homeScore}.`
        : `The match ended in a ${homeScore}-${awayScore} draw.`;
      body = `${homeTeam} played ${awayTeam} in the ${competitionName} on ${fullDateLabel}. ${resultSentence}${context}`;
    } else {
      const kickoff = new Date(match.utcDate);
      const dateLabel = kickoff.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const kickoffLabel = kickoff.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
      });

      title = `Preview: ${homeTeam} vs ${awayTeam} — ${dateLabel}`;
      summary = `${homeTeam} face ${awayTeam} in the ${competitionName} on ${dateLabel}.`;
      body = `${homeTeam} face ${awayTeam} in the ${competitionName}. Kickoff is ${kickoffLabel}.${context}`;
    }

    items.push({
      title,
      summary,
      body,
      sourceUrl: `https://www.football-data.org/matches/${match.id}`,
      sourceName: "football-data.org",
      category: categoryFor(competitionCode),
      publishedAt: new Date(match.utcDate),
      homeCrestUrl,
      awayCrestUrl,
    });
  }

  return items;
}

export async function fetchFootballData(): Promise<RawMatchItem[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.warn("FOOTBALL_DATA_API_KEY not set — skipping football-data.org ingestion");
    return [];
  }

  const { dateFromPast, dateToPast, dateFromFuture, dateToFuture } = dateRange();
  const items: RawMatchItem[] = [];

  for (const competitionCode of currentShard()) {
    // Real league-table context (position, points, form) — not every
    // competition/stage has one (e.g. knockout-only rounds), in which case
    // this comes back empty and match articles just skip the extra context.
    const standings = await fetchStandings(apiKey, competitionCode);
    await sleep(REQUEST_DELAY_MS);

    const finished = await fetchCompetitionMatches(
      apiKey, competitionCode, "FINISHED", dateFromPast, dateToPast, standings
    );
    items.push(...finished);
    await sleep(REQUEST_DELAY_MS);

    const scheduled = await fetchCompetitionMatches(
      apiKey, competitionCode, "SCHEDULED", dateFromFuture, dateToFuture, standings
    );
    items.push(...scheduled);
    await sleep(REQUEST_DELAY_MS);
  }

  return items;
}