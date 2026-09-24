import Link from "next/link";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, or, ilike, desc } from "drizzle-orm";
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

// Title-or-summary ilike search — no full-text index exists on this table
// (no pg_trgm/tsvector setup), and at this scale a plain ilike scan is
// plenty fast; matches the same pattern already used by club/player pages'
// own team/player-name search and the admin queue's title filter, rather
// than reaching for new search infrastructure for what's still a simple
// substring match.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results = query
    ? await db.select().from(article)
        .where(and(
          eq(article.status, "published"),
          or(ilike(article.title, `%${query}%`), ilike(article.summary, `%${query}%`))
        ))
        .orderBy(desc(article.publishedAt))
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
                    {/* alignItems: "center" -- without it this fixed-height
                        thumbnail sits top-aligned against the taller
                        title+summary text beside it, a visible empty gap
                        whenever the text runs longer than the thumbnail
                        (confirmed live 2026-09-24, same root cause fixed in
                        8 places site-wide). */}
                    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
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
