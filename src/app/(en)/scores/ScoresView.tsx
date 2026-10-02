import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import SportsScoreIcon from "@mui/icons-material/SportsScore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { fetchScoreboard } from "@/lib/scores/scoreboard";
import { ScoresBoard } from "@/components/scores/ScoresBoard";
import { getDict } from "@/lib/i18n/dictionary";
import { LOCALES } from "@/lib/i18n/locales";

// Rugby/Athletics/Formula 1 deliberately excluded — news-only categories
// with no structured match data. `category` stays the query param name so
// existing links (/scores?category=cricket) keep working.
const SPORT_FILTERS: { label: string; category: string | null }[] = [
  { label: "All", category: null },
  { label: "Football", category: "football" },
  { label: "Cricket", category: "cricket" },
  { label: "NFL", category: "american-football" },
  { label: "College Football", category: "college-football" },
  { label: "NBA", category: "basketball" },
  { label: "WNBA", category: "wnba" },
  { label: "MLB", category: "baseball" },
  { label: "NHL", category: "hockey" },
  { label: "Volleyball", category: "volleyball" },
];

// Wide enough that "Yesterday"/"Tomorrow" are complete in any time zone.
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function scoresMetadata(locale?: string) {
  const t = getDict(locale).scores;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/scores" } };
}

// The scoreboard for English (locale undefined) or a language edition, which
// lists only the sports it covers and uses its own labels.
export async function ScoresView({ category: rawCategory, locale }: { category?: string; locale?: string }) {
  const t = getDict(locale);
  const filters = locale
    ? [{ label: t.scores.all, category: null as string | null }, ...t.sports.map((s) => ({ label: s.label, category: s.category as string | null }))]
    : SPORT_FILTERS;
  const active = filters.find((f) => f.category === rawCategory) ?? filters[0];
  const edition = locale ? LOCALES[locale].categories : null;
  const fetched = await fetchScoreboard({ windowMs: WINDOW_MS, sport: active.category ?? undefined });
  const matches = edition ? fetched.filter((m) => edition.some((c) => c === m.sport || c.startsWith(m.sport + "/"))) : fetched;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <SportsScoreIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
          {t.scores.title}
        </Typography>
        <Link href="/standings" style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center" }}>
            {t.scores.standingsLink} <ChevronRightIcon sx={{ fontSize: 18 }} />
          </Typography>
        </Link>
      </Stack>

      <Box component="nav" aria-label="Sports" sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        {filters.map((f) => {
          const isActive = f.category === active.category;
          return (
            <Link
              key={f.label}
              href={f.category ? `/scores?category=${f.category}` : "/scores"}
              aria-current={isActive ? "page" : undefined}
              style={{ textDecoration: "none" }}
            >
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  px: 1.75,
                  py: 0.6,
                  borderRadius: 5,
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: isActive ? "text.primary" : "divider",
                  bgcolor: isActive ? "text.primary" : "transparent",
                  color: isActive ? "background.paper" : "text.secondary",
                  "&:hover": isActive ? {} : { borderColor: "text.secondary", color: "text.primary" },
                }}
              >
                {f.label}
              </Box>
            </Link>
          );
        })}
      </Box>

      <ScoresBoard
        matches={matches}
        emptyLabel={t.scores.emptyDay(active.category ? active.label : null)}
      />
    </Container>
  );
}
