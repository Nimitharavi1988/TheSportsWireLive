import Link from "next/link";
import Image from "next/image";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { LiveMatchStatus } from "@/lib/liveMatches";
import { categoryChipStyle } from "@/lib/categoryDisplay";

export interface LiveMatchRow {
  id: string;
  slug: string;
  summary: string;
  category: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  homeScoreText: string | null;
  awayScoreText: string | null;
  kickoffAt: Date | null;
  matchState: LiveMatchStatus;
  // True for a match with no structured score data at all (see
  // liveCricket.ts's news-headline fallback) — real team names and a real
  // headline, but no per-team score to show, so the per-team rows below
  // would otherwise fall back to a "yet to bat" that's simply untrue for a
  // match already in progress. Renders as a plain team-names line instead.
  isNewsDerived?: boolean;
  // Other recent headlines about either team, for live/finished matches —
  // see liveCricket.ts's relatedNewsFor. Empty for upcoming matches (no
  // real coverage of the match itself exists yet).
  relatedArticles?: { id: string; slug: string; title: string }[];
}

// One shared status badge — pulsing red dot for a genuinely live match, a
// neutral kickoff date for one that hasn't started, and a solid checkmark
// for a settled result. Matches the visual language sports apps (ESPN,
// Google) use so each state reads at a glance without needing to parse text.
export function StatusBadge({ state, kickoffAt }: { state: LiveMatchStatus; kickoffAt: Date | null }) {
  if (state === "live") {
    return (
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
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
    );
  }
  if (state === "finished") {
    return (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <CheckCircleIcon sx={{ fontSize: 13, color: "primary.main" }} />
        <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, letterSpacing: "0.05em" }}>
          RESULT{kickoffAt ? ` · ${kickoffAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        </Typography>
      </Stack>
    );
  }
  return (
    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.05em" }}>
      UPCOMING{kickoffAt ? ` · ${kickoffAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
    </Typography>
  );
}

function TeamRow({ crest, name, scoreText, category, compact }: { crest: string | null; name: string | null; scoreText: string | null; category: string; compact: boolean }) {
  // "Yet to bat" is a real, accurate cricket concept (the second team
  // genuinely hasn't batted yet) — showing it for every other sport this
  // widget now covers was simply wrong (an NFL/NBA/MLB team doesn't "bat").
  // No equivalent per-team waiting state exists for those sports (both
  // teams start simultaneously), so a neutral dash is the honest fallback
  // rather than inventing sport-specific terminology for each one.
  const noScoreLabel = category === "cricket" ? "yet to bat" : "—";
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {crest && <Image src={crest} alt="" width={compact ? 22 : 28} height={compact ? 22 : 28} style={{ flexShrink: 0 }} />}
      <Typography sx={{ fontSize: compact ? 13.5 : 15, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
        {name ?? "—"}
      </Typography>
      <Typography
        sx={{
          fontSize: compact ? 14 : 16,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
          color: scoreText ? "text.primary" : "text.secondary",
        }}
      >
        {scoreText ?? noScoreLabel}
      </Typography>
    </Stack>
  );
}

// A Google-style live score card: pulsing LIVE badge, each team on its own
// row with its score right-aligned (rather than a single horizontal
// "TeamA v TeamB" line), and the fuller status text (cricketData.ts's
// summary, e.g. "India need 45 runs to win") below as secondary context.
// The score line itself (e.g. "221/3 (4.1)") comes from
// extractTeamScoreLine — real per-innings data that was already being
// fetched every poll, just not surfaced this way before. Shared between
// /scores and the homepage sidebar so both stay visually identical.
export function LiveScorecard({ match, compact = false }: { match: LiveMatchRow; compact?: boolean }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: compact ? 1.5 : 2,
        borderColor: match.matchState === "live" ? "primary.main" : "divider",
        borderWidth: match.matchState === "live" ? 1.5 : 1,
      }}
    >
      {/* A separate <Link> from "More on this match" below, not one wrapping
          <Link> around the whole card — those go to different articles, and
          nesting <a> tags is invalid HTML (same reasoning as the homepage's
          Player News section). */}
      <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
        <Box sx={{ transition: "background-color 0.15s", "&:hover": { bgcolor: "action.hover" } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: compact ? 1 : 1.25 }}>
            <StatusBadge state={match.matchState} kickoffAt={match.kickoffAt} />
            {/* Sport label — this card can now be any match-data sport, not
                just cricket, so which one it is needs to be legible at a
                glance, especially when several sports are mixed together on
                the "All" view. */}
            <Typography
              variant="caption"
              sx={{ color: categoryChipStyle(match.category).color, fontWeight: 700, letterSpacing: "0.03em" }}
            >
              {categoryChipStyle(match.category).label}
            </Typography>
          </Stack>
          {match.isNewsDerived ? (
            <Typography sx={{ fontSize: compact ? 13.5 : 15, fontWeight: 700, mb: compact ? 1 : 1.25 }}>
              {match.homeTeam} vs {match.awayTeam}
            </Typography>
          ) : (
            <Stack spacing={compact ? 0.5 : 0.75} sx={{ mb: compact ? 1 : 1.25 }}>
              <TeamRow crest={match.homeCrestUrl} name={match.homeTeam} scoreText={match.homeScoreText} category={match.category} compact={compact} />
              <TeamRow crest={match.awayCrestUrl} name={match.awayTeam} scoreText={match.awayScoreText} category={match.category} compact={compact} />
            </Stack>
          )}
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              fontSize: compact ? 12 : 13,
              display: "-webkit-box",
              WebkitLineClamp: compact ? 2 : 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {match.summary}
          </Typography>
        </Box>
      </Link>
      {match.relatedArticles && match.relatedArticles.length > 0 && (
        <Box sx={{ mt: compact ? 1 : 1.25, pt: compact ? 1 : 1.25, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "text.secondary", mb: 0.5, textTransform: "uppercase", letterSpacing: 0.3 }}>
            More on this match
          </Typography>
          <Stack spacing={0.5}>
            {match.relatedArticles.map((a) => (
              <Link key={a.id} href={`/article/${a.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Typography
                  sx={{ fontSize: compact ? 12 : 12.5, "&:hover": { color: "primary.main" }, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {a.title}
                </Typography>
              </Link>
            ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
