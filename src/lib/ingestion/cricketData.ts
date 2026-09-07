/**
 * Pulls current/recent cricket matches from CricketData.org's free tier
 * (formerly CricAPI). Covers international matches, IPL, and other major
 * leagues currently in progress or recently finished.
 *
 * Docs: https://cricketdata.org/
 * Free tier: 100 requests/day.
 */
import { db } from "../db";
import type { RawMatchItem } from "./footballData";
import { fetchCommonsFile } from "./wikimediaImages";
import { matchCountry, isInternationalFormat, type CricketCountry } from "./cricketCountries";

const BASE_URL = "https://api.cricapi.com/v1";
const SOURCE_NAME = "CricketData.org";

// Real national flags, reusing the same trusted, license-verified Wikimedia
// pipeline as player photos, for genuinely international matches — team
// crest data doesn't exist in this API tier the way it does for football, so
// every cricket article was previously falling back to a generic,
// frequently-repeated stock photo regardless of who was actually playing.
// Cached per country within a single ingestion run since the same countries
// (India, Australia, England...) recur across many matches in one run.
const flagCache = new Map<string, Awaited<ReturnType<typeof fetchCommonsFile>>>();

async function fetchFlag(country: CricketCountry) {
  if (!flagCache.has(country.flagFile)) {
    flagCache.set(country.flagFile, await fetchCommonsFile(country.flagFile));
  }
  return flagCache.get(country.flagFile)!;
}

// "TeamA vs TeamB, 12th Match, ..." — the consistent shape of `match.name`
// across every sample seen from this API, both franchise and international.
function extractTeams(matchName: string): [string, string] | null {
  const m = matchName.match(/^(.+?)\s+vs\s+(.+?),/i);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

// CricketData.org DOES return a real per-team logo directly on the match
// object (`teamInfo[].img`) — this was missed originally (not documented
// clearly, and the sandbox used to investigate it was network-blocked from
// the live API for a while). Confirmed live: most teams get a real,
// team-specific CDN image; a team with no logo on file gets this exact
// generic placeholder icon instead of a missing/null field, so it has to be
// filtered out explicitly rather than just checking truthiness.
export const GENERIC_PLACEHOLDER_IMG = "https://h.cricapi.com/img/icon512.png";

export function isRealLogo(img: unknown): img is string {
  return typeof img === "string" && img.length > 0 && img !== GENERIC_PLACEHOLDER_IMG;
}

// Real logos straight from the source take priority — no extra API call,
// no ambiguity, and (unlike the flag fallback below) covers domestic
// franchise/league teams too, not just national sides. Requires BOTH teams
// to have a real logo, never just one — mixing a real team badge with a
// missing/placeholder crest would look broken, not just incomplete.
export function extractTeamLogos(match: any): { homeCrestUrl?: string; awayCrestUrl?: string } {
  const teamInfo = Array.isArray(match.teamInfo) ? match.teamInfo : [];
  const home = teamInfo[0]?.img;
  const away = teamInfo[1]?.img;
  if (isRealLogo(home) && isRealLogo(away)) {
    return { homeCrestUrl: home, awayCrestUrl: away };
  }
  return {};
}

// Fallback for when CricketData.org has no real logo for one or both teams
// (common for national sides, less common for well-known franchises) — only
// sets real flags when the match is unambiguously international (by
// standard cricket format terminology, not by team name alone) AND both team
// names resolve exactly to a recognized national side — see
// cricketCountries.ts for why this two-part check matters.
export async function fetchInternationalFlags(
  matchName: string
): Promise<{ homeCrestUrl?: string; awayCrestUrl?: string }> {
  if (!isInternationalFormat(matchName)) return {};

  const teams = extractTeams(matchName);
  if (!teams) return {};

  const [homeCountry, awayCountry] = teams.map(matchCountry);
  if (!homeCountry || !awayCountry) return {};

  const [homeFlag, awayFlag] = await Promise.all([fetchFlag(homeCountry), fetchFlag(awayCountry)]);
  if (!homeFlag || !awayFlag) return {};

  return { homeCrestUrl: homeFlag.url, awayCrestUrl: awayFlag.url };
}

// A single ingest run makes exactly one call here, so the real risk to the
// 100 req/day free-tier cap is polling frequency, not per-run volume — cron
// firing every 15 min alone would burn 96/100. Enforce a floor independent
// of how often ingestion actually runs, using Source.lastPolledAt (tracked
// in the DB so it holds regardless of process restarts). 20 min caps this
// at ~72 calls/day, leaving real headroom for manual/test runs.
const MIN_POLL_INTERVAL_MS = 20 * 60 * 1000;

export async function fetchCricketData(): Promise<RawMatchItem[]> {
  const apiKey = process.env.CRICKETDATA_API_KEY;
  if (!apiKey) {
    console.warn("CRICKETDATA_API_KEY not set — skipping cricket ingestion");
    return [];
  }

  const vertical = await db.vertical.findUnique({ where: { name: "sports" } });
  const source = vertical
    ? await db.source.findFirst({ where: { verticalId: vertical.id, name: SOURCE_NAME } })
    : null;

  if (source?.lastPolledAt && Date.now() - source.lastPolledAt.getTime() < MIN_POLL_INTERVAL_MS) {
    const nextOkAt = new Date(source.lastPolledAt.getTime() + MIN_POLL_INTERVAL_MS);
    console.log(
      `CricketData.org polled recently (last: ${source.lastPolledAt.toISOString()}) — skipping until ${nextOkAt.toISOString()} to conserve the 100 req/day free-tier limit`
    );
    return [];
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/currentMatches?apikey=${apiKey}&offset=0`);
  } catch (err) {
    // A network-level failure here (DNS, timeout, connection reset) must
    // not throw — this call runs inside a Promise.all alongside
    // football-data.org and RSS ingestion, so an uncaught rejection would
    // take down the entire ingest run over one flaky source.
    console.error("CricketData.org fetch failed (network error):", err);
    return [];
  }

  // Record the poll attempt regardless of outcome — a failed request still
  // consumes a slot against the daily quota.
  if (vertical) {
    if (source) {
      await db.source.update({ where: { id: source.id }, data: { lastPolledAt: new Date() } });
    } else {
      await db.source.create({
        data: { verticalId: vertical.id, name: SOURCE_NAME, type: "api", config: {}, lastPolledAt: new Date() },
      });
    }
  }

  if (!res.ok) {
    console.error(`CricketData.org fetch failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: RawMatchItem[] = [];

  for (const match of data.data ?? []) {
    if (!match.name || !match.id) continue;

    const title = match.name;

    let scoreText = "";
    if (Array.isArray(match.score) && match.score.length > 0) {
      scoreText = match.score
        .map((s: any) => `${s.inning ?? ""}: ${s.r ?? "?"}/${s.w ?? "?"} (${s.o ?? "?"} ov)`)
        .join(", ");
    }

    const summary = scoreText
      ? `${match.status ?? "Match update"}. ${scoreText}`
      : match.status ?? `${title} — match details.`;

    const inningsLines = Array.isArray(match.score)
      ? match.score.map((s: any) => `${s.inning ?? "Innings"}: ${s.r ?? "?"}/${s.w ?? "?"} in ${s.o ?? "?"} overs.`)
      : [];
    const bodyParts = [
      `${title}.`,
      match.status ? `${match.status}.` : null,
      match.venue ? `Venue: ${match.venue}.` : null,
      ...inningsLines,
    ].filter(Boolean);
    const body = bodyParts.join(" ");

    const crests = extractTeamLogos(match);
    if (!crests.homeCrestUrl) {
      Object.assign(crests, await fetchInternationalFlags(title));
    }

    items.push({
      title,
      summary,
      body,
      sourceUrl: `https://cricketdata.org/`,
      sourceName: "CricketData.org",
      category: "cricket",
      publishedAt: match.dateTimeGMT ? new Date(match.dateTimeGMT) : new Date(),
      ...crests,
    });
  }

  return items;
}