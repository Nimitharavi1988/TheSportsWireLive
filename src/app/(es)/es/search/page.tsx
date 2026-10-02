import type { Metadata } from "next";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { StoryCard } from "@/components/StoryCard";
import { ES } from "@/lib/i18n/es";
import { searchSpanishStories } from "@/lib/i18n/spanishArticles";

// Search results are thin, query-specific pages: useful to readers, not for
// the index.
export const metadata: Metadata = { title: ES.search.title, robots: { index: false, follow: true } };

export default async function SpanishSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim().slice(0, 100) ?? "";
  const results = query.length >= 2 ? await searchSpanishStories(query) : [];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: 3 }}>
      <Typography variant="h1" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: { xs: "1.6rem", sm: "2rem" }, mb: 2.5 }}>
        {query ? `${ES.search.results} “${query}”` : ES.search.title}
      </Typography>
      {!query ? (
        <Typography sx={{ color: "text.secondary" }}>{ES.search.prompt}</Typography>
      ) : results.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>{ES.search.none} “{query}”.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {results.map((a) => (
            <StoryCard key={a.id} article={{ ...a, highlighted: false }} locale="es" showSummary />
          ))}
        </Stack>
      )}
    </Container>
  );
}
