import Link from "next/link";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ArticleRow } from "@/components/ArticleRow";
import { EntityAvatar } from "@/components/EntityAvatar";
import { FollowButton } from "@/components/FollowButton";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary } from "@/lib/articleSummary";
import { popularEntities, searchEntities, type EntityResult } from "@/lib/entitySearch";
import { activeCompetitionEntities, competitionSearchItems } from "@/lib/competitions";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import SearchIcon from "@mui/icons-material/Search";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return {
    title: q ? `"${q}" — Search Results` : "Search",
    robots: { index: false }, // query-driven pages aren't worth indexing individually
  };
}

// Full results page behind the header search's "See all results". Real
// Postgres full-text search (tsvector + GIN index, see db/schema.ts's
// `language`/searchVector comment and the migration that added them).
// websearch_to_tsquery accepts natural user input directly (quoted phrases,
// -exclusion, implicit AND between words) and ts_rank orders title matches
// (weight A) above buried body mentions (weight C). English-only for now
// (see schema.ts's language field comment).
//
// Layout follows the shared big-site pattern: matching teams/players/sports
// first (with Follow), then sport filter chips with counts, then a dense
// list of stories with sport and time on every row.
const FETCH_LIMIT = 60;
const SHOW_LIMIT = 30;

// "football/world-cup" counts under Football — the filter chips are sports.
const topLevelSport = (category: string) => category.split("/")[0];

function EntityCard({ entity }: { entity: EntityResult }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      {/* Plain <Link> wrappers throughout this server component — MUI's
          Box component={Link} can't cross the server/client boundary. */}
      <Link href={entity.href} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, "&:hover .entity-name": { color: "primary.main" } }}>
          <EntityAvatar initials={entity.initials} color={entity.color} size={36} />
          <Box sx={{ minWidth: 0 }}>
            <Typography className="entity-name" sx={{ fontSize: 15, fontWeight: 600 }} noWrap>{entity.name}</Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }} noWrap>{entity.subtitle}</Typography>
          </Box>
        </Box>
      </Link>
      <FollowButton kind={entity.kind} slug={entity.slug} name={entity.name} />
    </Box>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; sport?: string }> }) {
  const { q, sport } = await searchParams;
  const query = q?.trim().slice(0, 120) ?? "";

  const rows = query
    ? await db.select().from(article)
        .where(and(
          eq(article.status, "published"),
          sql`"searchVector" @@ websearch_to_tsquery('english', ${query})`
        ))
        .orderBy(sql`ts_rank("searchVector", websearch_to_tsquery('english', ${query})) DESC`)
        .limit(FETCH_LIMIT)
    : [];
  const entities = query ? searchEntities(query, 6, await competitionSearchItems()) : [];
  const live = query ? [] : await activeCompetitionEntities(4);

  const sportCounts = new Map<string, number>();
  for (const row of rows) {
    const s = topLevelSport(row.category);
    sportCounts.set(s, (sportCounts.get(s) ?? 0) + 1);
  }
  const activeSport = sport && sportCounts.has(sport) ? sport : null;
  const results = (activeSport ? rows.filter((r) => topLevelSport(r.category) === activeSport) : rows).slice(0, SHOW_LIMIT);
  const filterHref = (s: string | null) => `/search?q=${encodeURIComponent(query)}${s ? `&sport=${s}` : ""}`;

  const chipSx = (active: boolean) => ({
    px: 1.5,
    py: 0.5,
    borderRadius: 5,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    whiteSpace: "nowrap",
    border: "1px solid",
    borderColor: active ? "primary.main" : "divider",
    bgcolor: active ? "primary.main" : "transparent",
    color: active ? "primary.contrastText" : "text.secondary",
    "&:hover": active ? {} : { borderColor: "text.secondary", color: "text.primary" },
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ maxWidth: 760 }}>
        <Box
          component="form"
          method="GET"
          role="search"
          sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, height: 52, borderRadius: 7, bgcolor: "action.hover", mb: 3, border: "1px solid transparent", "&:focus-within": { borderColor: "primary.main" } }}
        >
          <SearchIcon sx={{ color: "text.secondary" }} />
          <InputBase
            name="q"
            defaultValue={query}
            placeholder="Search teams, players, stories"
            autoFocus={!query}
            sx={{ flex: 1, fontSize: 17 }}
            inputProps={{ "aria-label": "Search Sports Wire Live", enterKeyHint: "search" }}
          />
        </Box>

        {!query && live.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary", mb: 1 }}>Happening now</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              {live.map((e) => <EntityCard key={e.slug} entity={e} />)}
            </Box>
          </Box>
        )}

        {!query && (
          <>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary", mb: 1 }}>Popular</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              {popularEntities().map((e) => <EntityCard key={`${e.kind}:${e.slug}`} entity={e} />)}
            </Box>
          </>
        )}

        {query && entities.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary", mb: 1 }}>Teams, players and competitions</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              {entities.map((e) => <EntityCard key={`${e.kind}:${e.slug}`} entity={e} />)}
            </Box>
          </Box>
        )}

        {query && rows.length === 0 && (
          <Box sx={{ py: 4 }}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>No stories match &ldquo;{query}&rdquo;</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
              Check the spelling, try fewer words, or search for a team or player name.
            </Typography>
          </Box>
        )}

        {rows.length > 0 && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary", mr: 0.5 }}>
                Stories{rows.length >= FETCH_LIMIT ? " (top matches)" : ""}
              </Typography>
              {sportCounts.size > 1 && (
                <>
                  <Link href={filterHref(null)} style={{ textDecoration: "none" }}>
                    <Box sx={chipSx(!activeSport)}>All {rows.length}</Box>
                  </Link>
                  {[...sportCounts.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                    <Link key={s} href={filterHref(s)} style={{ textDecoration: "none" }}>
                      <Box sx={chipSx(activeSport === s)}>
                        {categoryChipStyle(s).label} {n}
                      </Box>
                    </Link>
                  ))}
                </>
              )}
            </Box>
            <Box component="section" aria-label="Search results">
              {results.map((a) => <ArticleRow key={a.id} article={a} summary={displaySummary(a)} />)}
            </Box>
          </>
        )}
      </Box>
    </Container>
  );
}
