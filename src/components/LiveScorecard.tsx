import Link from "next/link";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { CricketMatchStatus } from "@/lib/liveCricket";

export interface LiveMatchRow {
  id: string;
  slug: string;
  summary: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  homeScoreText: string | null;
  awayScoreText: string | null;
  kickoffAt: Date | null;
  matchState: CricketMatchStatus;
}

// One shared status badge — pulsing red dot for a genuinely live match, a
// neutral kickoff date for one that hasn't started, and a solid checkmark
// for a settled result. Matches the visual language sports apps (ESPN,
// Google) use so each state reads at a glance without needing to parse text.
export function StatusBadge({ state, kickoffAt }: { state: CricketMatchStatus; kickoffAt: Date | null }) {
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
          RESULT
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

function TeamRow({ crest, name, scoreText, compact }: { crest: string | null; name: string | null; scoreText: string | null; compact: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {crest && <img src={crest} alt="" width={compact ? 22 : 28} height={compact ? 22 : 28} style={{ flexShrink: 0 }} />}
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
        {scoreText ?? "yet to bat"}
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
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Paper
        variant="outlined"
        sx={{
          p: compact ? 1.5 : 2,
          borderColor: match.matchState === "live" ? "primary.main" : "divider",
          borderWidth: match.matchState === "live" ? 1.5 : 1,
          transition: "background-color 0.15s",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box sx={{ mb: compact ? 1 : 1.25 }}>
          <StatusBadge state={match.matchState} kickoffAt={match.kickoffAt} />
        </Box>
        <Stack spacing={compact ? 0.5 : 0.75} sx={{ mb: compact ? 1 : 1.25 }}>
          <TeamRow crest={match.homeCrestUrl} name={match.homeTeam} scoreText={match.homeScoreText} compact={compact} />
          <TeamRow crest={match.awayCrestUrl} name={match.awayTeam} scoreText={match.awayScoreText} compact={compact} />
        </Stack>
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
      </Paper>
    </Link>
  );
}
