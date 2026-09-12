import Link from "next/link";
import { db } from "@/lib/db";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { fetchLiveCricketMatches } from "@/lib/liveCricket";
import { LiveScorecard } from "@/components/LiveScorecard";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import SportsScoreIcon from "@mui/icons-material/SportsScore";

export const revalidate = 300;

const SPORT_FILTERS = [
  { label: "All", category: null },
  { label: "Football", category: "football" },
  { label: "Cricket", category: "cricket" },
  { label: "NFL", category: "american-football" },
];

export const metadata = { title: "Scores & Fixtures", alternates: { canonical: "/scores" } };

interface MatchRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  sourceName: string;
  summary: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  kickoffAt: Date | null;
}

function MatchCard({ match }: { match: MatchRow }) {
  const style = categoryChipStyle(match.category);
  const isCricket = match.category === "cricket";
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  return (
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.75,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          transition: "border-color 0.15s, background-color 0.15s",
          "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
        }}
      >
        <Chip
          label={style.label}
          size="small"
          sx={{ bgcolor: `${style.color}1a`, color: style.color, fontWeight: 600, flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 1, flexWrap: "nowrap" }}>
          {match.homeCrestUrl && <img src={match.homeCrestUrl} alt="" width={22} height={22} style={{ flexShrink: 0 }} />}
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, flex: "1 1 0" }} noWrap>
            {match.homeTeam ?? "—"}
          </Typography>
          {hasScore ? (
            <Box
              component="span"
              sx={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 700,
                bgcolor: "background.default",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 4,
                px: 0.9,
                py: 0.1,
                flexShrink: 0,
              }}
            >
              {match.homeScore}–{match.awayScore}
            </Box>
          ) : (
            <Typography component="span" sx={{ color: "text.secondary", flexShrink: 0 }}>
              {isCricket ? "v" : "vs"}
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, flex: "1 1 0", textAlign: "right" }} noWrap>
            {match.awayTeam ?? "—"}
          </Typography>
          {match.awayCrestUrl && <img src={match.awayCrestUrl} alt="" width={22} height={22} style={{ flexShrink: 0 }} />}
        </Box>
        <Typography variant="caption" sx={{ color: "text.secondary", flexShrink: 0, whiteSpace: "nowrap" }}>
          {match.kickoffAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Typography>
      </Paper>
    </Link>
  );
}

export default async function ScoresPage(props: { searchParams: Promise<{ category?: string }> }) {
  const searchParams = await props.searchParams;
  const category = searchParams.category ?? null;

  const where = {
    status: "published" as const,
    ...(category ? { category: { startsWith: category } } : {}),
  };

  const select = {
    id: true, slug: true, title: true, category: true, sourceName: true, summary: true,
    homeTeam: true, awayTeam: true, homeScore: true, awayScore: true,
    homeCrestUrl: true, awayCrestUrl: true, kickoffAt: true,
  };

  const showCricketInProgress = category === null || category === "cricket";

  const [upcoming, recent, cricketInProgress] = await Promise.all([
    db.article.findMany({
      where: { ...where, matchStatus: "scheduled", kickoffAt: { gte: new Date() } },
      orderBy: { kickoffAt: "asc" },
      take: 25,
      select,
    }),
    db.article.findMany({
      where: { ...where, matchStatus: "finished" },
      orderBy: { kickoffAt: "desc" },
      take: 25,
      select,
    }),
    showCricketInProgress ? fetchLiveCricketMatches(10) : Promise.resolve([]),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <SportsScoreIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4">Scores & Fixtures</Typography>
      </Stack>
      <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
        Recent results and upcoming fixtures across football, cricket, and NFL.
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
        {SPORT_FILTERS.map((f) => (
          <Link key={f.label} href={f.category ? `/scores?category=${f.category}` : "/scores"} style={{ textDecoration: "none" }}>
            <Chip
              label={f.label}
              clickable
              variant={category === f.category ? "filled" : "outlined"}
              color={category === f.category ? "primary" : "default"}
            />
          </Link>
        ))}
      </Box>

      {cricketInProgress.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 1.5, fontSize: 18 }}>
            Cricket — In Progress
          </Typography>
          <Stack spacing={1.5} sx={{ mb: 4 }}>
            {cricketInProgress.map((match) => (
              <LiveScorecard key={match.id} match={match} />
            ))}
          </Stack>
        </>
      )}

      <Typography variant="h6" sx={{ mb: 1.5, fontSize: 18 }}>
        Upcoming Fixtures
      </Typography>
      {upcoming.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 2 }}>No upcoming fixtures right now — check back soon.</Typography>
      ) : (
        <Stack spacing={1} sx={{ mb: 4 }}>
          {upcoming.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </Stack>
      )}

      <Typography variant="h6" sx={{ mb: 1.5, fontSize: 18 }}>
        Recent Results
      </Typography>
      {recent.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 2 }}>No recent results yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {recent.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </Stack>
      )}
    </Container>
  );
}
