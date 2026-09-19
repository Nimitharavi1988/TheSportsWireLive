import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, like, gte, asc, desc } from "drizzle-orm";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { fetchLiveCricketMatches, type CricketMatchStatus } from "@/lib/liveCricket";
import { LiveScorecard, StatusBadge } from "@/components/LiveScorecard";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import SportsScoreIcon from "@mui/icons-material/SportsScore";

export const revalidate = 300;

// Rugby/Athletics/Formula 1 deliberately excluded — news-only categories
// with no structured match data (no kickoffAt/score fields to filter by
// here at all: F1 is RSS-only editorial content, same reasoning as the
// other two). Hockey/Volleyball DO have real structured match data (see
// nhlData.ts/volleyballData.ts), so they belong here same as the rest.
const SPORT_FILTERS = [
  { label: "All", category: null },
  { label: "Football", category: "football" },
  { label: "Cricket", category: "cricket" },
  { label: "NFL", category: "american-football" },
  { label: "NBA", category: "basketball" },
  { label: "MLB", category: "baseball" },
  { label: "NHL", category: "hockey" },
  { label: "Volleyball", category: "volleyball" },
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

function MatchCard({ match, state }: { match: MatchRow; state: CricketMatchStatus }) {
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
          {match.homeCrestUrl && <Image src={match.homeCrestUrl} alt="" width={22} height={22} style={{ flexShrink: 0 }} />}
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
          {match.awayCrestUrl && <Image src={match.awayCrestUrl} alt="" width={22} height={22} style={{ flexShrink: 0 }} />}
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <StatusBadge state={state} kickoffAt={match.kickoffAt} />
        </Box>
      </Paper>
    </Link>
  );
}

// Streamed independently (see the Suspense boundary in ScoresPage below) —
// fetchLiveCricketMatches is a real external API round-trip and, confirmed
// live, the slowest of this page's data calls. Splitting it out means
// Upcoming Fixtures/Recent Results (plain DB queries) render immediately
// instead of the whole page waiting on cricket's own live-match lookup —
// same pattern already used on the homepage for its slower widgets.
async function CricketInProgressSection({ category }: { category: string | null }) {
  const showCricketInProgress = category === null || category === "cricket";
  if (!showCricketInProgress) return null;

  // See the original page comment this replaces — a low take() cut
  // multi-day Test matches out entirely (they sort toward the back of a
  // kickoffAt-desc order behind shorter-format matches that started more
  // recently), so this fetches everything currently live instead.
  const cricketInProgress = await fetchLiveCricketMatches(30);
  if (cricketInProgress.length === 0) return null;

  return (
    <>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Cricket
      </Typography>
      <Stack spacing={1.5} sx={{ mb: 4 }}>
        {cricketInProgress.map((match) => (
          <LiveScorecard key={match.id} match={{ ...match, category: "cricket" }} />
        ))}
      </Stack>
    </>
  );
}

function CricketInProgressSkeleton() {
  return (
    <Stack spacing={1.5} sx={{ mb: 4 }}>
      <Skeleton width={100} height={28} />
      <Skeleton variant="rounded" height={90} />
    </Stack>
  );
}

export default async function ScoresPage(props: { searchParams: Promise<{ category?: string }> }) {
  const searchParams = await props.searchParams;
  const category = searchParams.category ?? null;

  const whereConditions = [
    eq(article.status, "published"),
    ...(category ? [like(article.category, `${category}%`)] : []),
  ];

  const select = {
    id: article.id, slug: article.slug, title: article.title, category: article.category,
    sourceName: article.sourceName, summary: article.summary,
    homeTeam: article.homeTeam, awayTeam: article.awayTeam,
    homeScore: article.homeScore, awayScore: article.awayScore,
    homeCrestUrl: article.homeCrestUrl, awayCrestUrl: article.awayCrestUrl, kickoffAt: article.kickoffAt,
  };

  const [upcoming, recent] = await Promise.all([
    db.select(select).from(article)
      .where(and(...whereConditions, eq(article.matchStatus, "scheduled"), gte(article.kickoffAt, new Date())))
      .orderBy(asc(article.kickoffAt))
      .limit(25),
    db.select(select).from(article)
      .where(and(...whereConditions, eq(article.matchStatus, "finished")))
      .orderBy(desc(article.kickoffAt))
      .limit(25),
  ]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <SportsScoreIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4">Scores & Fixtures</Typography>
      </Stack>
      <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
        Recent results and upcoming fixtures across football, cricket, NFL, NBA, and MLB.
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

      <Suspense fallback={<CricketInProgressSkeleton />}>
        <CricketInProgressSection category={category} />
      </Suspense>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Upcoming Fixtures
      </Typography>
      {upcoming.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 2 }}>No upcoming fixtures right now — check back soon.</Typography>
      ) : (
        <Stack spacing={1} sx={{ mb: 4 }}>
          {upcoming.map((match) => (
            <MatchCard key={match.id} match={match} state="upcoming" />
          ))}
        </Stack>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Recent Results
      </Typography>
      {recent.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 2 }}>No recent results yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {recent.map((match) => (
            <MatchCard key={match.id} match={match} state="finished" />
          ))}
        </Stack>
      )}
    </Container>
  );
}
