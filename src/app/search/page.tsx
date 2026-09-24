import Link from "next/link";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary } from "@/lib/articleSummary";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return {
    title: q ? `"${q}" — Search Results` : "Search",
    robots: { index: false }, // query-driven pages aren't worth indexing individually
  };
}

// Real Postgres full-text search (tsvector + GIN index, see db/schema.ts's
// `language`/searchVector comment and the migration that added them) —
// replaced the previous plain ilike-on-title-or-summary scan (2026-09-24).
// websearch_to_tsquery accepts natural user input directly (quoted phrases,
// -exclusion, implicit AND between words) rather than needing a hand-built
// query string, and ranks by ts_rank so a title match (weight A) beats a
// buried body mention (weight C) instead of both being equally "found" the
// way ilike was. Body text is now searchable too, not just title/summary —
// a real gap before (a story could headline-mismatch its own content and
// never surface). English-only for now (see schema.ts's language field
// comment) since no Spanish content exists yet; the query-side config
// should switch on a language param once that ships, matching how the
// column's own stored vector already will.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results = query
    ? await db.select().from(article)
        .where(and(
          eq(article.status, "published"),
          sql`"searchVector" @@ websearch_to_tsquery('english', ${query})`
        ))
        .orderBy(sql`ts_rank("searchVector", websearch_to_tsquery('english', ${query})) DESC`)
        .limit(30)
    : [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 3 }}>
        <SearchIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4">Search</Typography>
      </Stack>

      <Box component="form" method="GET" sx={{ display: "flex", gap: 1.5, mb: 4, maxWidth: 480 }}>
        <TextField
          name="q"
          defaultValue={query}
          placeholder="Search football, cricket, NFL news…"
          size="small"
          fullWidth
          autoFocus
        />
        <Button type="submit" variant="contained">Search</Button>
      </Box>

      {!query ? (
        <Typography sx={{ color: "text.secondary" }}>
          Enter a team, player, or story keyword to search recent coverage.
        </Typography>
      ) : results.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>
          No results for &ldquo;{query}&rdquo; — try a different team, player, or keyword.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
          </Typography>
          <Stack spacing={2}>
            {results.map((a) => (
              <Link key={a.id} href={`/article/${a.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Card variant="outlined" sx={{ "&:hover": { borderColor: "primary.main" } }}>
                  <CardContent>
                    <Stack direction="row" spacing={2}>
                      <ArticleThumb article={a} size={64} fallbackColor={categoryChipStyle(a.category).color} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Chip
                          label={categoryChipStyle(a.category).label}
                          size="small"
                          variant="outlined"
                          sx={{
                            mb: 1,
                            color: categoryChipStyle(a.category).color,
                            borderColor: categoryChipStyle(a.category).color,
                            fontWeight: 600,
                          }}
                        />
                        <Typography variant="h6" component="h2" gutterBottom>
                          {a.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {displaySummary(a)}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </Stack>
        </>
      )}
    </Container>
  );
}
