/**
 * One-off (re-runnable) generator for the "search-link" player tier — pulls
 * full team rosters (real, current names) from ESPN's public roster
 * endpoint for every team in the leagues below, excludes anyone already in
 * TRACKED_PLAYERS (who get their real profile page instead, not a search
 * link), and prints ROSTER_PLAYERS-shaped entries for rosterPlayers.ts.
 *
 * Same "print, review, then paste" pattern as generateTeamEntities.ts and
 * nameGapReport.ts. Re-run periodically to refresh for roster churn
 * (trades/cuts/retirements) — this is a real, live data snapshot, not
 * something to treat as permanently accurate.
 *
 * Run: npx tsx scripts/generateRosterPlayers.ts
 */
import { TRACKED_PLAYERS } from "../src/lib/players";

interface EspnTeamsResponse {
  sports?: { leagues?: { teams?: { team: { id: string; displayName: string } }[] }[] }[];
}
interface EspnRosterResponse {
  athletes?: { items?: { fullName?: string }[]; position?: string }[] | { fullName?: string }[];
}

const LEAGUES: { sport: string; league: string; label: string }[] = [
  { sport: "football", league: "nfl", label: "NFL" },
  { sport: "basketball", league: "nba", label: "NBA" },
  { sport: "baseball", league: "mlb", label: "MLB" },
  { sport: "hockey", league: "nhl", label: "NHL" },
  { sport: "soccer", league: "eng.1", label: "Premier League" },
  { sport: "soccer", league: "ger.1", label: "Bundesliga" },
  { sport: "soccer", league: "ita.1", label: "Serie A" },
  { sport: "soccer", league: "fra.1", label: "Ligue 1" },
  { sport: "soccer", league: "usa.1", label: "MLS" },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchTeamIds(sport: string, league: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=100`);
  if (!res.ok) return [];
  const data = (await res.json()) as EspnTeamsResponse;
  return (data.sports?.[0]?.leagues?.[0]?.teams ?? []).map((t) => ({ id: t.team.id, name: t.team.displayName }));
}

async function fetchRosterNames(sport: string, league: string, teamId: string): Promise<string[]> {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/roster`);
    if (!res.ok) return [];
    const data = (await res.json()) as EspnRosterResponse;
    const athletes = data.athletes ?? [];
    // NFL groups by position ({position, items:[...]}), NBA/MLB/NHL/soccer
    // return a flat athlete array directly -- handle both real shapes.
    const flat = Array.isArray(athletes) && athletes.length > 0 && "items" in athletes[0]
      ? (athletes as { items?: { fullName?: string }[] }[]).flatMap((g) => g.items ?? [])
      : (athletes as { fullName?: string }[]);
    return flat.map((a) => a.fullName).filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}

async function main() {
  const trackedNames = new Set(
    TRACKED_PLAYERS.flatMap((p) => [p.name.toLowerCase(), ...p.searchTerms.map((s) => s.toLowerCase())])
  );
  const allNames = new Set<string>();

  for (const { sport, league, label } of LEAGUES) {
    const teams = await fetchTeamIds(sport, league);
    console.error(`${label}: ${teams.length} teams`);
    for (const team of teams) {
      const names = await fetchRosterNames(sport, league, team.id);
      for (const n of names) allNames.add(n);
      await sleep(150);
    }
  }

  const fresh = [...allNames]
    .filter((n) => !trackedNames.has(n.toLowerCase()))
    // Skip single-word names (no space) -- these are almost always a
    // short/common-word false-positive risk on their own (unlike the
    // TRACKED_PLAYERS list, which curates full names + deliberately safe
    // surname-only terms case by case). A roster name with no space at all
    // is rare (some Brazilian players go by one name) but not worth the
    // collision risk at this scale without individual review.
    .filter((n) => n.trim().includes(" "))
    .sort((a, b) => a.localeCompare(b));

  console.error(`\nTotal unique roster names: ${allNames.size}, already tracked: ${allNames.size - fresh.length}, new: ${fresh.length}`);
  for (const name of fresh) {
    console.log(`  { name: "${name.replace(/"/g, '\\"')}", searchTerms: ["${name.replace(/"/g, '\\"')}"] },`);
  }
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
