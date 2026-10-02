/**
 * Builds src/lib/rosterPlayersScoped.ts: player names grouped by sport, for the
 * article linker (entityLinks.tsx). Unlike the global roster tier
 * (rosterPlayers.ts), these are linked only inside articles of their own sport,
 * so a college football name can't link in a story about someone else with the
 * same name, and an article never scans a sport's names it can't contain.
 *
 * Sources (all free, checked 2026-10-02):
 *  - ESPN team rosters: La Liga, Championship, Eredivisie, Primeira Liga,
 *    Brasileirão (football); WNBA; college football (FBS teams only — the
 *    teams list also holds ~360 lower-division programs that rarely make news).
 *  - Jolpica (the Ergast successor): this season's Formula 1 drivers.
 *  - Cricket: ESPN has no team roster list, so the names come from the squads on
 *    the scorecards the match-detail job stores (DataSnapshot "match-detail:*",
 *    matchDetailSync.ts) — current players, batters and bowlers and everyone
 *    named to play.
 * Not here: rugby (ESPN publishes no rugby rosters; checked eight leagues),
 * volleyball (ESPN's college volleyball rosters come back empty) and athletics (no clean free source; Wikidata mixed in astronauts and actors).
 *
 * Excludes anyone already tracked (they get their own page) or already in the
 * global roster tier, and single-word names (too collision-prone).
 *
 * Run: npx tsx --env-file=.env scripts/generateScopedRosters.ts
 * Re-run periodically for roster churn, like generateRosterPlayers.ts.
 */
import { writeFileSync } from "node:fs";
import { like } from "drizzle-orm";
import { db } from "../src/db";
import { dataSnapshot } from "../src/db/schema";
import { TRACKED_PLAYERS } from "../src/lib/players";
import { ROSTER_PLAYERS } from "../src/lib/rosterPlayers";

interface EspnTeamsResponse {
  sports?: { leagues?: { teams?: { team: { id: string; displayName: string } }[] }[] }[];
}
interface EspnRosterResponse {
  athletes?: { items?: { fullName?: string }[] }[] | { fullName?: string }[];
}

// scope: the article category (top level) the names link in.
const ESPN: { scope: string; sport: string; league: string; label: string }[] = [
  { scope: "football", sport: "soccer", league: "esp.1", label: "La Liga" },
  { scope: "football", sport: "soccer", league: "eng.2", label: "Championship" },
  { scope: "football", sport: "soccer", league: "ned.1", label: "Eredivisie" },
  { scope: "football", sport: "soccer", league: "por.1", label: "Primeira Liga" },
  { scope: "football", sport: "soccer", league: "bra.1", label: "Brasileirão" },
  { scope: "wnba", sport: "basketball", league: "wnba", label: "WNBA" },
  { scope: "college-football", sport: "football", league: "college-football", label: "College football" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HEADERS = { "User-Agent": "SportsWireLive/1.0", Accept: "application/json, */*", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Mode": "cors" };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

// FBS team ids from the standings (the teams list ignores its group filter).
async function fbsTeamIds(): Promise<Set<string>> {
  const d = await getJson<{ children?: unknown[] }>("https://site.api.espn.com/apis/v2/sports/football/college-football/standings?group=80&level=3");
  const ids = new Set<string>();
  const walk = (o: { standings?: { entries?: { team?: { id?: string } }[] }; children?: unknown[] }) => {
    for (const e of o.standings?.entries ?? []) if (e.team?.id) ids.add(e.team.id);
    for (const c of (o.children ?? []) as (typeof o)[]) walk(c);
  };
  if (d) walk(d as Parameters<typeof walk>[0]);
  return ids;
}

async function espnNames(sport: string, league: string, label: string, only?: Set<string>): Promise<string[]> {
  const teamsData = await getJson<EspnTeamsResponse>(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=500`);
  const teams = (teamsData?.sports?.[0]?.leagues?.[0]?.teams ?? []).filter((t) => !only || only.has(t.team.id));
  console.error(`${label}: ${teams.length} teams`);
  const names: string[] = [];
  for (const t of teams) {
    const r = await getJson<EspnRosterResponse>(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${t.team.id}/roster`);
    const athletes = r?.athletes ?? [];
    // Grouped by position ({items:[…]}) for football, flat for the rest.
    const flat = athletes.length > 0 && "items" in athletes[0] ? (athletes as { items?: { fullName?: string }[] }[]).flatMap((g) => g.items ?? []) : (athletes as { fullName?: string }[]);
    for (const a of flat) if (a.fullName) names.push(a.fullName);
    await sleep(120);
  }
  return names;
}

async function formulaOneNames(): Promise<string[]> {
  const year = new Date().getFullYear();
  const d = await getJson<{ MRData?: { DriverTable?: { Drivers?: { givenName: string; familyName: string }[] } } }>(`https://api.jolpi.ca/ergast/f1/${year}/drivers.json`);
  const drivers = d?.MRData?.DriverTable?.Drivers ?? [];
  console.error(`Formula 1: ${drivers.length} drivers (${year})`);
  return drivers.map((x) => `${x.givenName} ${x.familyName}`);
}

// Names on stored cricket scorecards: batters, bowlers, those yet to bat.
async function cricketNames(): Promise<string[]> {
  const rows = await db.select({ data: dataSnapshot.data }).from(dataSnapshot).where(like(dataSnapshot.key, "match-detail:%"));
  const names = new Set<string>();
  for (const { data } of rows) {
    const d = data as { kind?: string; card?: { innings?: { batting?: { name: string }[]; bowling?: { name: string }[]; didNotBat?: string[] }[]; yetToBat?: { players?: string[] }[] } };
    if (d.kind !== "cricket") continue;
    for (const i of d.card?.innings ?? []) {
      for (const b of i.batting ?? []) names.add(b.name);
      for (const b of i.bowling ?? []) names.add(b.name);
      for (const n of i.didNotBat ?? []) names.add(n);
    }
    for (const y of d.card?.yetToBat ?? []) for (const p of y.players ?? []) names.add(p);
  }
  console.error(`Cricket: ${names.size} names from ${rows.length} stored match details`);
  return [...names];
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function main() {
  const skip = new Set<string>([
    ...TRACKED_PLAYERS.flatMap((p) => [p.name, ...p.searchTerms]).map(norm),
    ...ROSTER_PLAYERS.map((p) => norm(p.name)),
  ]);
  const byScope = new Map<string, Set<string>>();
  const add = (scope: string, names: string[]) => {
    const set = byScope.get(scope) ?? new Set<string>();
    for (const raw of names) {
      const n = raw.replace(/\s+/g, " ").trim();
      // Two words or more, no stray characters that would break the linker's pattern.
      if (!n.includes(" ") || n.length < 5 || n.length > 40 || skip.has(norm(n))) continue;
      set.add(n);
    }
    byScope.set(scope, set);
  };

  const fbs = await fbsTeamIds();
  if (fbs.size === 0) throw new Error("no FBS team ids");
  for (const e of ESPN) add(e.scope, await espnNames(e.sport, e.league, e.label, e.scope === "college-football" ? fbs : undefined));
  add("formula-1", await formulaOneNames());
  add("cricket", await cricketNames());

  const scopes = [...byScope.keys()].sort();
  let total = 0;
  const body = scopes
    .map((scope) => {
      const names = [...(byScope.get(scope) ?? [])].sort((a, b) => a.localeCompare(b));
      total += names.length;
      console.error(`  ${scope.padEnd(18)} ${names.length}`);
      return `  ${JSON.stringify(scope)}: [\n${names.map((n) => `    ${JSON.stringify(n)},`).join("\n")}\n  ],`;
    })
    .join("\n");

  const header = `/**
 * Player names by sport, linked to an on-site search only inside articles of
 * that sport (entityLinks.tsx createEntityLinker(sport)). Generated by
 * scripts/generateScopedRosters.ts on ${new Date().toISOString().slice(0, 10)} — see that file for the sources and what is
 * left out (rugby, athletics). Anyone tracked (players.ts) or in the global
 * roster tier (rosterPlayers.ts) is excluded, and single-word names.
 *
 * A live snapshot, not a permanently accurate roster: re-run the generator
 * periodically, same as rosterPlayers.ts.
 */
export const SCOPED_ROSTER: Record<string, string[]> = {
${body}
};
`;
  writeFileSync(new URL("../src/lib/rosterPlayersScoped.ts", import.meta.url), header);
  console.error(`\nWrote ${total} names in ${scopes.length} sports.`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
