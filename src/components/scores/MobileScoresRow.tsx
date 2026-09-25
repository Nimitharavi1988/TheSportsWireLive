import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { ScrollRow } from "../ScrollRow";
import { MiniScoreCard } from "./MiniScoreCard";
import { LiveRefresher } from "./LiveRefresher";
import { LIVE_RED } from "./ScoreCard";

// Phone-only score row at the very top of the homepage. The site-wide score
// strip (MatchTicker) is hidden below `sm`, and the sidebar "Live now" box
// ends up far down the single-column phone layout — so phones had no scores
// near the top at all (found 2026-09-25: the box sat ~6,900px down). Same
// cards, data and ordering as the strip: live games first, then the next
// kickoffs, then recent results. Swipe sideways for more.
export function MobileScoresRow({ matches }: { matches: ScoreMatch[] }) {
  if (matches.length === 0) return null;
  const inPlay = matches.some((m) => m.state === "live" || m.state === "paused");
  const liveCount = matches.filter((m) => m.state === "live").length;

  return (
    <Box component="section" aria-label="Scores" sx={{ display: { xs: "block", sm: "none" }, mb: 2, mx: -2 }}>
      <LiveRefresher active={inPlay} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 2, mb: 0.5 }}>
        {liveCount > 0 && <Box aria-hidden sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: LIVE_RED }} />}
        <Typography component="h2" sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
          {liveCount > 0 ? `Live now · ${liveCount}` : "Scores"}
        </Typography>
        <Link href="/scores" style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center" }}>
            All scores <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Typography>
        </Link>
      </Box>
      <ScrollRow gap={0} sx={{ px: 1.4, scrollSnapType: "x mandatory", "& > *": { scrollSnapAlign: "start", flexShrink: 0 } }}>
        {matches.map((m) => (
          <MiniScoreCard key={m.id} match={m} />
        ))}
      </ScrollRow>
    </Box>
  );
}
