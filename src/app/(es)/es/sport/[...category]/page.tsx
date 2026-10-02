import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { StoryCard } from "@/components/StoryCard";
import { ES, ES_SPORTS, categoryLabelEs } from "@/lib/i18n/es";
import { listSpanishStories } from "@/lib/i18n/spanishArticles";
import { LOCALES } from "@/lib/i18n/locales";

export const revalidate = 60;
export async function generateStaticParams() {
  return [];
}

// Only sports the Spanish site covers; anything else 404s (the middleware has
// no English fallback for /sport/<other>, since that sport simply isn't here).
function resolveCategory(parts: string[]): string | null {
  const category = parts.join("/");
  const allowed = new Set([...ES_SPORTS.map((s) => s.category), ...LOCALES.es.categories]);
  return allowed.has(category) ? category : null;
}

export async function generateMetadata(props: { params: Promise<{ category: string[] }> }): Promise<Metadata> {
  const category = resolveCategory((await props.params).category);
  if (!category) return {};
  const label = categoryLabelEs(category);
  const en = process.env.SITE_URL ?? "https://sportswirelive.com";
  return {
    title: `Noticias de ${label}`,
    description: `Últimas noticias de ${label}: resultados, crónicas y análisis en español, actualizados las 24 horas.`,
    alternates: { canonical: `/sport/${category}`, languages: { es: `/sport/${category}`, en: `${en}/sport/${category}` } },
  };
}

export default async function SpanishSportPage(props: { params: Promise<{ category: string[] }> }) {
  const category = resolveCategory((await props.params).category);
  if (!category) notFound();
  const stories = await listSpanishStories({ limit: 40, categories: [category] });

  return (
    <Container maxWidth="lg" component="main" sx={{ py: 3 }}>
      <Typography variant="h1" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: { xs: "1.6rem", sm: "2rem" }, mb: 2.5 }}>
        {ES.section.moreIn} {categoryLabelEs(category)}
      </Typography>
      {stories.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>{ES.section.empty}</Typography>
      ) : (
        <Stack spacing={1.5}>
          {stories.map((a, i) => (
            <StoryCard key={a.id} article={{ ...a, highlighted: false }} locale="es" showSummary={i < 10} />
          ))}
        </Stack>
      )}
    </Container>
  );
}
