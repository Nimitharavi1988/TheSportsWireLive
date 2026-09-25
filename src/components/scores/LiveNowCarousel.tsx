"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { LIVE_RED, ScoreCard } from "./ScoreCard";
import { LiveRefresher } from "./LiveRefresher";

// Homepage "Live now" box: one standard score card at a time (the same card
// as /scores), with prev/next and a link to the full scoreboard. Replaces
// LiveScoreboardCarousel's own one-off card layout.
export function LiveNowCarousel({ matches }: { matches: ScoreMatch[] }) {
  const [index, setIndex] = useState(0);
  if (matches.length === 0) return null;
  const current = matches[Math.min(index, matches.length - 1)];
  const liveCount = matches.filter((m) => m.state === "live").length;
  const go = (delta: number) => setIndex((i) => (i + delta + matches.length) % matches.length);

  return (
    <Box component="section" aria-label="Scores" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", p: 1.5 }}>
      <LiveRefresher active={matches.some((m) => m.state === "live" || m.state === "paused")} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, flex: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
          {liveCount > 0 ? (
            <>
              <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: LIVE_RED }} />
              Live now
              <Box component="span" sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>
                {liveCount} {liveCount === 1 ? "game" : "games"}
              </Box>
            </>
          ) : (
            "Scores"
          )}
        </Typography>
        {matches.length > 1 && (
          <>
            <IconButton size="small" aria-label="Previous game" onClick={() => go(-1)}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontSize: 12, color: "text.secondary", fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "center" }}>
              {Math.min(index, matches.length - 1) + 1} of {matches.length}
            </Typography>
            <IconButton size="small" aria-label="Next game" onClick={() => go(1)}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>

      <Box aria-live="polite">
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: 0.75 }} noWrap>
          {current.leagueLabel}
        </Typography>
        <ScoreCard match={current} />
      </Box>

      <Link href="/scores" style={{ textDecoration: "none" }}>
        <Typography component="span" sx={{ mt: 1.25, fontSize: 13, fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          All scores <ChevronRightIcon sx={{ fontSize: 16 }} />
        </Typography>
      </Link>
    </Box>
  );
}
