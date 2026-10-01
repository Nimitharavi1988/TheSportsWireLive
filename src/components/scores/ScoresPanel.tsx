"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { liveListUrl } from "../LiveTicker";
import { UpdatedAgo } from "./DataFreshness";
import { FeaturedScore } from "./FeaturedScore";
import { LIVE_RED } from "./ScoreCard";
import { MiniScoreCard } from "./MiniScoreCard";
import { useLiveScores } from "./useLiveScores";

// Scores panel for the homepage and sport sections (right column, md+): the
// lead game as a featured card, then the next few, with chips to focus on one
// sport. The top strip is the quick look across every sport; this is the
// focused view. Chips reuse the strip's polling URL per sport, so switching
// costs one request. Phones have the strip instead.
const MORE = 3;
const SPORT_ORDER = ["cricket", "football", "american-football", "basketball", "baseball", "hockey", "wnba", "college-football", "volleyball"];

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={on}
      onClick={onClick}
      sx={{
        flexShrink: 0,
        px: 1.25,
        py: 0.35,
        minHeight: 28,
        borderRadius: 5,
        font: "inherit",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        border: "1px solid",
        borderColor: on ? "text.primary" : "divider",
        bgcolor: on ? "text.primary" : "background.paper",
        color: on ? "background.paper" : "text.secondary",
        "&:hover": on ? {} : { borderColor: "text.secondary", color: "text.primary" },
      }}
    >
      {label}
    </Box>
  );
}

export function ScoresPanel({ initial, sport }: { initial: ScoreMatch[]; sport?: string }) {
  // null = every sport. A sport section is already narrowed, so no chips there.
  const [picked, setPicked] = useState<string | null>(sport ?? null);
  const chips = sport ? [] : SPORT_ORDER.filter((s) => initial.some((m) => m.sport === s));
  const start = picked ? initial.filter((m) => m.sport === picked) : initial;
  const matches = useLiveScores(start, { mode: "list", url: liveListUrl(picked), fetchOnStart: Boolean(picked) && picked !== sport });
  if (initial.length === 0) return null;

  const [lead, ...rest] = matches;
  const liveCount = matches.filter((m) => m.state === "live").length;
  const newest = matches.reduce<string | null>((n, m) => (n === null || m.updatedAt > n ? m.updatedAt : n), null);
  const href = picked ? `/scores?category=${picked}` : "/scores";

  return (
    <Box component="section" aria-label="Scores" sx={{ display: { xs: "none", md: "block" }, mb: 3, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography component="h2" variant="h6" sx={{ flex: 1 }}>
          Scores
        </Typography>
        {liveCount > 0 && (
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: 13, fontWeight: 700, color: "#b71c1c" }}>
            <Box aria-hidden component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: LIVE_RED }} />
            {liveCount} live
          </Box>
        )}
      </Box>

      {chips.length > 1 && (
        <Box role="group" aria-label="Filter scores by sport" sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.5, mb: 1, "&::-webkit-scrollbar": { height: 0 } }}>
          <Chip label="All" on={picked === null} onClick={() => setPicked(null)} />
          {chips.map((s) => (
            <Chip key={s} label={categoryChipStyle(s).label} on={picked === s} onClick={() => setPicked(s)} />
          ))}
        </Box>
      )}

      {lead ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1 }}>
          <FeaturedScore match={lead} />
          {rest.slice(0, MORE).map((m) => (
            <MiniScoreCard key={m.id} match={m} fluid />
          ))}
        </Box>
      ) : (
        <Typography sx={{ py: 3, textAlign: "center", fontSize: 14, color: "text.secondary", border: "1px dashed", borderColor: "divider", borderRadius: 3 }}>
          No games right now.
        </Typography>
      )}

      <Box sx={{ mt: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
          {newest && <UpdatedAgo iso={newest} />}
        </Typography>
        <Link href={href} style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: "primary.main", display: "inline-flex", alignItems: "center" }}>
            All scores <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Typography>
        </Link>
      </Box>
    </Box>
  );
}
