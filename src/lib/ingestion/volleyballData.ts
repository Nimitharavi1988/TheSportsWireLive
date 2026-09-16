/**
 * Pulls volleyball match data from API-Sports.io's volleyball API
 * (v1.volleyball.api-sports.io), the same account/key as
 * apiFootballVenue.ts (API_FOOTBALL_KEY — one key works across every
 * api-sports.io sport). Confirmed live (2026-09-16): date-based queries
 * work on the free tier (season-history queries don't, same rule as
 * football), and this sub-API has its own independent 100 req/day quota,
 * separate from the football one.
 *
 * Self-throttled the same way as apiFootballVenue.ts / cricketData.ts —
 * a persistent Source.lastPolledAt row, since each ingestion run is a
 * fresh process (no in-memory state survives between runs).
 *
 * New sport category "volleyball". No real venue field confirmed in this
 * API's /games response, so RawMatchItem.venue is left unset here rather
 * than guessed at.
 */
import { db } from "../db";
import type { RawMatchItem } from "./footballData";

const SOURCE_NAME = "API-Volleyball";
const MIN_POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour — same conservatism as apiFootballVenue.ts

interface VolleyballTeam {
  id: number;
  name: string;
  logo?: string;
}

interface VolleyballGame {
  id: number;
  date: string;
  status: { long: string; short: string };
  league: { name: string };
  teams: { home: VolleyballTeam; away: VolleyballTeam };
  scores: { home: number | null; away: number | null };
}

export async function fetchVolleyballData(): Promise<RawMatchItem[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return [];

  const vertical = await db.vertical.findUnique({ where: { name: "sports" } });
  const source = vertical
    ? await db.source.findFirst({ where: { verticalId: vertical.id, name: SOURCE_NAME } })
    : null;

  if (source?.lastPolledAt && Date.now() - source.lastPolledAt.getTime() < MIN_POLL_INTERVAL_MS) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`https://v1.volleyball.api-sports.io/games?date=${today}`, {
    headers: { "x-apisports-key": apiKey },
  }).catch((err) => {
    console.error("API-Volleyball fetch failed:", err);
    return null;
  });

  if (vertical) {
    if (source) {
      await db.source.update({ where: { id: source.id }, data: { lastPolledAt: new Date() } });
    } else {
      await db.source.create({
        data: { verticalId: vertical.id, name: SOURCE_NAME, type: "api", config: {}, lastPolledAt: new Date() },
      });
    }
  }

  if (!res || !res.ok) {
    if (res) console.error(`API-Volleyball fetch failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: RawMatchItem[] = [];

  for (const game of (data.response ?? []) as VolleyballGame[]) {
    const finished = game.status?.short === "FT";
    const scheduled = game.status?.short === "NS";
    if (!finished && !scheduled) continue;

    const homeTeam = game.teams.home.name;
    const awayTeam = game.teams.away.name;

    let title: string;
    let summary: string;
    let body: string;

    if (finished) {
      const homeScore = game.scores.home ?? 0;
      const awayScore = game.scores.away ?? 0;
      const fullDateLabel = new Date(game.date).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });

      title = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;
      summary = `${homeTeam} played ${awayTeam} in the ${game.league.name}, finishing ${homeScore}-${awayScore}.`;
      const resultSentence =
        homeScore > awayScore ? `${homeTeam} won ${homeScore}-${awayScore}.`
        : awayScore > homeScore ? `${awayTeam} won ${awayScore}-${homeScore}.`
        : `The match finished ${homeScore}-${awayScore}.`;
      body = `${homeTeam} played ${awayTeam} in the ${game.league.name} on ${fullDateLabel}. ${resultSentence}`;
    } else {
      const startTime = new Date(game.date);
      const dateLabel = startTime.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const startLabel = startTime.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
      });

      title = `Preview: ${homeTeam} vs ${awayTeam} — ${dateLabel}`;
      summary = `${homeTeam} face ${awayTeam} in the ${game.league.name} on ${dateLabel}.`;
      body = `${homeTeam} face ${awayTeam} in the ${game.league.name}. First serve is ${startLabel}.`;
    }

    items.push({
      title,
      summary,
      body,
      sourceUrl: `https://www.volleyball.api-sports.io/games/${game.id}`,
      sourceName: SOURCE_NAME,
      category: "volleyball",
      publishedAt: new Date(game.date),
      homeCrestUrl: game.teams.home.logo,
      awayCrestUrl: game.teams.away.logo,
      homeTeam,
      awayTeam,
      homeScore: finished ? game.scores.home ?? undefined : undefined,
      awayScore: finished ? game.scores.away ?? undefined : undefined,
      matchStatus: finished ? "finished" : "scheduled",
      kickoffAt: new Date(game.date),
      dedupeKey: `api-volleyball-${game.id}`,
      seriesLabel: game.league.name,
    });
  }

  return items;
}
