/**
 * One-off (re-runnable) generator: pulls the full, real team list per league
 * from ESPN's public, keyless site.api.espn.com endpoint family (same one
 * already powering nflData.ts/nbaData.ts/standings widgets) and prints
 * TrackedClub-shaped entries ready to paste into clubs.ts.
 *
 * Deliberately prints instead of writing the file directly -- same "review
 * before committing generated data" reasoning as nameGapReport.ts. Re-run
 * this later to pick up new/renamed teams; it's not a one-time dump.
 *
 * Run: npx tsx scripts/generateTeamEntities.ts
 */

interface EspnTeamsResponse {
  sports?: { leagues?: { teams?: { team: { id: string; displayName: string; shortDisplayName?: string } }[] }[] }[];
}

const LEAGUES: { sport: string; league: string; label: string; tag: string }[] = [
  { sport: "football", league: "nfl", label: "NFL", tag: "american-football" },
  { sport: "basketball", league: "nba", label: "NBA", tag: "basketball" },
  { sport: "baseball", league: "mlb", label: "MLB", tag: "baseball" },
  { sport: "hockey", league: "nhl", label: "NHL", tag: "hockey" },
  { sport: "soccer", league: "eng.1", label: "Premier League", tag: "football" },
  { sport: "soccer", league: "ger.1", label: "Bundesliga", tag: "football" },
  { sport: "soccer", league: "ita.1", label: "Serie A", tag: "football" },
  { sport: "soccer", league: "fra.1", label: "Ligue 1", tag: "football" },
  { sport: "soccer", league: "usa.1", label: "MLS", tag: "football" },
];

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (Montréal -> Montreal) before the ascii-only regex below
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchTeams(sport: string, league: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=100`);
  if (!res.ok) {
    console.error(`FAILED ${sport}/${league}: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as EspnTeamsResponse;
  const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams.map((t) => ({ id: t.team.id, name: t.team.displayName }));
}

async function main() {
  // Dedupe against the existing hand-curated soccer clubs in clubs.ts --
  // several of the 5 soccer leagues fetched here already have a few
  // best-known clubs hand-entered (different slug in PSG's case: "psg" vs
  // this script's generated "paris-saint-germain" for the same real club),
  // so compare by NAME/searchTerm overlap, not just slug string equality.
  const { TRACKED_CLUBS } = await import("../src/lib/clubs");
  const existingNames = new Set(
    TRACKED_CLUBS.flatMap((c) => [c.name.toLowerCase(), ...c.searchTerms.map((s) => s.toLowerCase())])
  );

  for (const { sport, league, label, tag } of LEAGUES) {
    const teams = await fetchTeams(sport, league);
    const fresh = teams.filter((t) => !existingNames.has(t.name.toLowerCase()));
    console.log(`\n// ${label} (${teams.length} teams total, ${teams.length - fresh.length} already tracked, ${fresh.length} new)`);
    for (const t of fresh.sort((a, b) => a.name.localeCompare(b.name))) {
      const slug = slugify(t.name);
      console.log(
        `  { slug: "${slug}", name: "${t.name}", searchTerms: ["${t.name}"], sport: "${tag}" },`
      );
    }
  }
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
