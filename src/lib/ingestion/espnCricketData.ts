/**
 * Cricket from ESPN (Cricinfo's scoreboard, free, no key): every match in
 * progress or about to start across international and domestic cricket,
 * with live scores. Added 2026-09-26 because the free CricketData tier
 * returned only English county matches for days — no internationals (e.g.
 * the Asian Games) at all. CricketData stays; where both have the same
 * match, the first to store it owns it (runIngest.ts, via matchKey), so no
 * match shows twice.
 *
 * Source: site.api.espn.com/apis/personalized/v2/scoreboard/header
 * ?sport=cricket — current events grouped by league. Shape checked live
 * 2026-09-26: event.status "pre"|"in"|"post", fullStatus.{longSummary,
 * dayNumber}, competitors[].{homeAway, displayName, score, logo}.
 */
import type { RawMatchItem } from "./footballData";
import { espnFetch } from "../espnFetch";

const HEADER_URL = "https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=us&lang=en";

interface EspnCricketCompetitor {
  homeAway?: "home" | "away";
  displayName: string;
  score?: string;
  logo?: string;
}

export interface EspnCricketEvent {
  id: string;
  date: string;
  endDate?: string;
  status: string;
  summary?: string;
  location?: string;
  link?: string;
  fullStatus?: { longSummary?: string; summary?: string; dayNumber?: number; type?: { detail?: string } };
  competitors: EspnCricketCompetitor[];
}

// A result line means the match is over even when ESPN still lists it as
// "in" for a while (seen live: "No result" on an "in" event).
const RESULT = /\b(won by|won the match|match drawn|drawn|tied|no result|abandoned|cancelled)\b/i;

function isMultiDay(event: EspnCricketEvent): boolean {
  return Boolean(event.endDate) && Date.parse(event.endDate!) - Date.parse(event.date) > 24 * 60 * 60 * 1000;
}

// One ESPN event -> the standard match item (pure, unit-tested).
export function espnCricketEventToItem(event: EspnCricketEvent, leagueName: string): RawMatchItem | null {
  const home = event.competitors.find((c) => c.homeAway === "home") ?? event.competitors[0];
  const away = event.competitors.find((c) => c.homeAway === "away") ?? event.competitors[1];
  if (!home || !away || home === away) return null;
  if (event.status !== "pre" && event.status !== "in" && event.status !== "post") return null;

  const statusLine = (event.fullStatus?.longSummary || event.summary || "").trim();
  const finished = event.status === "post" || RESULT.test(statusLine);
  const started = event.status !== "pre";
  // "Day 2: Stumps" for a multi-day match, matching CricketData's status
  // lines, so the scoreboard's stumps/day handling reads both the same way.
  const day = event.fullStatus?.dayNumber;
  // Day prefix only where it means something: day 2 onwards, or stumps.
  const showDay = isMultiDay(event) && day && (day >= 2 || /stumps/i.test(statusLine)) && !/^day \d/i.test(statusLine);
  const note = started && statusLine ? (showDay ? `Day ${day}: ${statusLine}` : statusLine) : undefined;
  const start = new Date(event.date);
  const dateLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const homeTeam = home.displayName;
  const awayTeam = away.displayName;
  const scoreText = (c: EspnCricketCompetitor) => (c.score?.trim() ? c.score.trim() : undefined);

  return {
    // Same title shape as CricketData ("X vs Y, <competition>"): it never
    // encodes the score, so it doesn't change as the match goes on.
    title: `${homeTeam} vs ${awayTeam}, ${leagueName}`,
    summary: finished && statusLine ? `${statusLine}.` : `${homeTeam} face ${awayTeam} in the ${leagueName} on ${dateLabel}.`,
    body: [
      `${homeTeam} ${finished ? "played" : "face"} ${awayTeam} in the ${leagueName}${event.location ? ` at ${event.location}` : ""}.`,
      scoreText(home) || scoreText(away) ? `Scores: ${homeTeam} ${scoreText(home) ?? "yet to bat"}, ${awayTeam} ${scoreText(away) ?? "yet to bat"}.` : "",
      note ? `${note}.` : "",
    ].filter(Boolean).join(" "),
    sourceUrl: event.link ?? `https://www.espncricinfo.com/`,
    sourceName: "ESPN Cricket",
    category: "cricket",
    publishedAt: start,
    homeCrestUrl: home.logo,
    awayCrestUrl: away.logo,
    homeTeam,
    awayTeam,
    homeScoreText: started ? scoreText(home) : undefined,
    awayScoreText: started ? scoreText(away) : undefined,
    matchStatus: finished ? "finished" : "scheduled",
    leagueLabel: leagueName,
    matchNote: note ?? null,
    kickoffAt: start,
    venue: event.location,
    dedupeKey: `espn-cricket-${event.id}`,
  };
}

export async function fetchEspnCricketData(): Promise<RawMatchItem[]> {
  try {
    const res = await espnFetch(HEADER_URL);
    if (!res.ok) {
      console.error(`ESPN cricket scoreboard fetch failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const items: RawMatchItem[] = [];
    for (const sport of data.sports ?? []) {
      for (const league of sport.leagues ?? []) {
        for (const event of (league.events ?? []) as EspnCricketEvent[]) {
          const item = espnCricketEventToItem(event, league.name ?? "Cricket");
          if (item) items.push(item);
        }
      }
    }
    return items;
  } catch (err) {
    console.error("ESPN cricket scoreboard fetch failed:", err);
    return [];
  }
}
