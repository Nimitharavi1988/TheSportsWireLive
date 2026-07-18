/**
 * One-off/rerunnable backfill: fills in homeCrestUrl/awayCrestUrl for
 * football-data.org articles ingested before crest capture was added to
 * runIngest.ts. Safe to rerun — only touches articles missing a crest.
 *
 *   npx tsx scripts/backfillCrests.ts
 */
import { db } from "../src/lib/db";

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITIONS = ["PL", "ELC", "BL1", "DED", "BSA", "PD", "FL1", "SA", "PPL", "CL", "EC", "WC"];
const REQUEST_DELAY_MS = 7000; // same free-tier rate limit as footballData.ts

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildCrestMap(apiKey: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const competitionCode of COMPETITIONS) {
    const res = await fetch(`${BASE_URL}/competitions/${competitionCode}/teams`, {
      headers: { "X-Auth-Token": apiKey },
    });

    if (res.ok) {
      const data = await res.json();
      for (const team of data.teams ?? []) {
        if (team.crest && team.name) map.set(team.name.toLowerCase(), team.crest);
        if (team.crest && team.shortName) map.set(team.shortName.toLowerCase(), team.crest);
      }
    } else {
      console.error(`Failed to fetch teams for ${competitionCode}: ${res.status}`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return map;
}

function parseTeams(title: string): { home: string; away: string } | null {
  const finished = title.match(/^(.+?)\s\d+-\d+\s(.+)$/);
  if (finished) return { home: finished[1], away: finished[2] };

  const preview = title.match(/^Preview:\s(.+?)\svs\s(.+?)\s—/);
  if (preview) return { home: preview[1], away: preview[2] };

  return null;
}

async function main() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY is not set");

  const articles = await db.article.findMany({
    where: {
      sourceName: "football-data.org",
      OR: [{ homeCrestUrl: null }, { awayCrestUrl: null }],
    },
  });

  console.log(`Found ${articles.length} football-data.org articles missing crests.`);
  if (articles.length === 0) {
    process.exit(0);
  }

  console.log("Building crest map from football-data.org (rate-limited, takes a few minutes)...");
  const crestMap = await buildCrestMap(apiKey);
  console.log(`Crest map built: ${crestMap.size} team names known.`);

  let updated = 0;
  let skipped = 0;

  for (const article of articles) {
    const teams = parseTeams(article.title);
    const homeCrestUrl = teams ? crestMap.get(teams.home.toLowerCase()) : undefined;
    const awayCrestUrl = teams ? crestMap.get(teams.away.toLowerCase()) : undefined;

    if (!homeCrestUrl || !awayCrestUrl) {
      skipped++;
      continue;
    }

    await db.article.update({ where: { id: article.id }, data: { homeCrestUrl, awayCrestUrl } });
    updated++;
  }

  console.log(`Backfill complete: ${updated} updated, ${skipped} skipped (team not found — usually a competition outside the free-tier list, or a renamed team).`);
  process.exit(0);
}

main();
