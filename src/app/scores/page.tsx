import Link from "next/link";
import { db } from "@/lib/db";
import { categoryChipStyle } from "@/lib/categoryDisplay";
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

// Bigger, more prominent card for cricket matches actually in progress —
// the plain MatchCard row (built for a scannable list of fixtures/results)
// undersold this compared to what users expect from a "live score" (e.g.
// Google's own live cards). The rich per-innings status text
// (cricketData.ts's summary, e.g. "India need 45 runs. India Inning:
// 187/4 (18.2 ov)...") was already being fetched and stored, just never
// surfaced prominently — this surfaces it as the card's main content
// instead of a generic "TeamA v TeamB" row.
function LiveScorecard({ match }: { match: MatchRow }) {
  return (
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2.25,
          borderColor: "primary.main",
          borderWidth: 1.5,
          transition: "background-color 0.15s",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: "#d32f2f",
              animation: "sw-live-pulse 1.5s ease-in-out infinite",
              "@keyframes sw-live-pulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
            }}
          />
          <Typography variant="caption" sx={{ color: "#d32f2f", fontWeight: 700, letterSpacing: "0.05em" }}>
            LIVE
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.25, flexWrap: "wrap" }}>
          {match.homeCrestUrl && <img src={match.homeCrestUrl} alt="" width={36} height={36} />}
          <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>
            {match.homeTeam}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>v</Typography>
          <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>
            {match.awayTeam}
          </Typography>
          {match.awayCrestUrl && <img src={match.awayCrestUrl} alt="" width={36} height={36} />}
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {match.summary}
        </Typography>
      </Paper>
    </Link>
  );
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

  // Cricket's ingestion (cricketData.ts) pulls "currentMatches" — matches
  // that are already underway, not fixed-future fixtures like football/NFL.
  // Their kickoffAt is in the past (the match already started) but
  // matchStatus isn't "finished" either (no result yet) — they were falling
  // through both the upcoming and recent queries below entirely, invisible
  // on this page. Scoped to cricket only: football/NFL's ingestion never
  // fetches an in-play state, so a past kickoffAt there just means the
  // FINISHED poll hasn't landed yet, not a genuine "in progress" state.
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
    showCricketInProgress
      ? db.article.findMany({
          where: { status: "published", category: { startsWith: "cricket" }, matchStatus: "scheduled", kickoffAt: { lt: new Date() } },
          orderBy: { kickoffAt: "desc" },
          take: 10,
          select,
        })
      : Promise.resolve([]),
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
