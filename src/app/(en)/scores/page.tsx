import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import SportsScoreIcon from "@mui/icons-material/SportsScore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { fetchScoreboard } from "@/lib/scores/scoreboard";
import { ScoresBoard } from "@/components/scores/ScoresBoard";

// Standard scoreboard (src/lib/scores/): one card design and one live/
// final/upcoming rule for every sport. Was 300s; 60s now that live games
// carry running scores and a clock — ScoresBoard also re-fetches every
// minute while anything is live.
export const revalidate = 60;

// Rugby/Athletics/Formula 1 deliberately excluded — news-only categories
// with no structured match data. `category` stays the query param name so
// existing links (/scores?category=cricket) keep working.
const SPORT_FILTERS = [
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
] as const;

// Wide enough that "Yesterday"/"Tomorrow" are complete in any time zone.
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export const metadata = {
  title: "Live Scores, Results & Fixtures",
  description: "Live scores, results and upcoming fixtures for football, cricket, NFL, NBA, MLB, NHL and volleyball on Sports Wire Live.",
  alternates: { canonical: "/scores" },
};

export default async function ScoresPage(props: { searchParams: Promise<{ category?: string }> }) {
  const { category: rawCategory } = await props.searchParams;
  const active = SPORT_FILTERS.find((f) => f.category === rawCategory) ?? SPORT_FILTERS[0];
  const matches = await fetchScoreboard({ windowMs: WINDOW_MS, sport: active.category ?? undefined });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <SportsScoreIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
          Scores
        </Typography>
        <Link href="/standings" style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center" }}>
            Standings <ChevronRightIcon sx={{ fontSize: 18 }} />
          </Typography>
        </Link>
      </Stack>

      <Box component="nav" aria-label="Sports" sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        {SPORT_FILTERS.map((f) => {
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
        emptyLabel={active.category ? `No ${active.label} games on this day.` : "No games on this day."}
      />
    </Container>
  );
}
