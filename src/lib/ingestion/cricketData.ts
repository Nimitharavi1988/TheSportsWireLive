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

const BASE_URL = "https://api.cricapi.com/v1";
const SOURCE_NAME = "CricketData.org";

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

  const res = await fetch(`${BASE_URL}/currentMatches?apikey=${apiKey}&offset=0`);

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

    items.push({
      title,
      summary,
      body,
      sourceUrl: `https://cricketdata.org/`,
      sourceName: "CricketData.org",
      category: "cricket",
      publishedAt: match.dateTimeGMT ? new Date(match.dateTimeGMT) : new Date(),
    });
  }

  return items;
}