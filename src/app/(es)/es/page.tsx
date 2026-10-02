import type { Metadata } from "next";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { StoryCard } from "@/components/StoryCard";
import { ES, ES_SPORTS } from "@/lib/i18n/es";
import { listSpanishStories } from "@/lib/i18n/spanishArticles";

// ISR: rendered once, served from cache, refreshed in the background.
export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: ES.metaTitle },
  description: ES.metaDescription,
  alternates: {
    canonical: "/",
    languages: { es: "/", en: process.env.SITE_URL ?? "https://sportswirelive.com" },
  },
};

export default async function SpanishHome() {
  const stories = await listSpanishStories({ limit: 80 });
  const latest = stories.slice(0, 12);

  const sections = ES_SPORTS.map((s) => ({ ...s, items: stories.filter((a) => a.category === s.category || a.category.startsWith(`${s.category}/`)).slice(0, 4) })).filter(
    (s) => s.items.length > 0,
  );

  return (
    <Container maxWidth="lg" component="main" sx={{ py: 3 }}>
      <Typography variant="h1" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: { xs: "1.6rem", sm: "2rem" }, mb: 0.5 }}>
        {ES.siteName}
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>{ES.tagline}</Typography>

      {stories.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>{ES.home.empty}</Typography>
      ) : (
        <>
          <Typography variant="h2" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.3rem", mb: 1.5 }}>
            {ES.home.latest}
          </Typography>
          <Stack spacing={1.5} sx={{ mb: 5 }}>
            {latest.map((a, i) => (
              <StoryCard key={a.id} article={{ ...a, highlighted: false }} locale="es" showSummary={i < 6} />
            ))}
          </Stack>

          {sections.length > 0 && (
            <Typography variant="h2" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.3rem", mb: 1.5 }}>
              {ES.home.bySport}
            </Typography>
          )}
          {sections.map((s) => (
            <Box key={s.category} component="section" sx={{ mb: 4 }}>
              <Typography
                component="a"
                href={`/sport/${s.category}`}
                variant="h3"
                sx={{ display: "inline-block", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.1rem", mb: 1, color: "primary.main", textDecoration: "none" }}
              >
                {s.label} →
              </Typography>
              <Stack spacing={1.5}>
                {s.items.map((a) => (
                  <StoryCard key={a.id} article={{ ...a, highlighted: false }} locale="es" />
                ))}
              </Stack>
            </Box>
          ))}
        </>
      )}
    </Container>
  );
}
