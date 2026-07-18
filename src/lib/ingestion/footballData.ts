/**
 * Pulls match data from football-data.org's free tier — all 12 competitions
 * included in the free plan, both finished results and upcoming fixtures
 * (previews). Includes retry-with-backoff if the free tier's rate limit
 * (10 requests/minute) gets hit.
 *
 * Docs: https://www.football-data.org/documentation/quickstart
 */

const BASE_URL = "https://api.football-data.org/v4";

const COMPETITIONS = [
  "PL", "ELC", "BL1", "DED", "BSA", "PD", "FL1", "SA", "PPL", "CL", "EC", "WC",
];

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
  sourceUrl: string;
  sourceName: string;
  category: string;
  publishedAt: Date;
  homeCrestUrl?: string;
  awayCrestUrl?: string;
}

async function fetchCompetitionMatches(
  apiKey: string,
  competitionCode: string,
  status: "FINISHED" | "SCHEDULED",
  dateFrom: string,
  dateTo: string,
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
    return fetchCompetitionMatches(apiKey, competitionCode, status, dateFrom, dateTo, attempt + 1);
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

    let title: string;
    let summary: string;

    if (status === "FINISHED") {
      const homeScore = match.score?.fullTime?.home;
      const awayScore = match.score?.fullTime?.away;
      title = `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;
      summary = `${homeTeam} played ${awayTeam} in the ${competitionName}, finishing ${homeScore}-${awayScore}.`;
    } else {
      const kickoff = new Date(match.utcDate);
      const dateLabel = kickoff.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      title = `Preview: ${homeTeam} vs ${awayTeam} — ${dateLabel}`;
      summary = `${homeTeam} face ${awayTeam} in the ${competitionName} on ${dateLabel}.`;
    }

    items.push({
      title,
      summary,
      sourceUrl: `https://www.football-data.org/matches/${match.id}`,
      sourceName: "football-data.org",
      category: categoryFor(competitionCode),
      publishedAt: new Date(match.utcDate),
      homeCrestUrl: match.homeTeam?.crest || undefined,
      awayCrestUrl: match.awayTeam?.crest || undefined,
    });
  }

  return items;
}

export async function fetchFootballData(): Promise<RawMatchItem[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY is not set in the environment");
  }

  const { dateFromPast, dateToPast, dateFromFuture, dateToFuture } = dateRange();
  const items: RawMatchItem[] = [];

  for (const competitionCode of COMPETITIONS) {
    const finished = await fetchCompetitionMatches(
      apiKey, competitionCode, "FINISHED", dateFromPast, dateToPast
    );
    items.push(...finished);
    await sleep(REQUEST_DELAY_MS);

    const scheduled = await fetchCompetitionMatches(
      apiKey, competitionCode, "SCHEDULED", dateFromFuture, dateToFuture
    );
    items.push(...scheduled);
    await sleep(REQUEST_DELAY_MS);
  }

  return items;
}