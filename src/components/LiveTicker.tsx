"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import Box from "@mui/material/Box";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { useLiveScores } from "./scores/useLiveScores";
import { TICKER_SIZE } from "@/lib/scores/liveUpdates";
import { MiniScoreCard } from "./scores/MiniScoreCard";

// Site-wide score strip under the header. Mini versions of the standard
// score card (src/components/scores/ScoreCard.tsx) from the same data and
// live/final/upcoming rules as /scores (fetchLiveNow): live games first,
// then the next kickoffs, then recent results. Was its own query and card
// style, with "LIVE" guessed from kickoff time and no clock.
const STRIP_BG = "#e9f1ec";

// The sport of a section page (/sport/cricket, /sport/football/world-cup),
// or null elsewhere.
export function sectionSport(pathname: string | null): string | null {
  const m = pathname?.match(/^\/sport\/([a-z0-9-]+)/);
  return m ? m[1] : null;
}

export function LiveTicker({ initial }: { initial: ScoreMatch[] }) {
  // On a sport's section the strip shows that sport's games (live first) —
  // the server-rendered list is every sport's, so it's narrowed here and
  // fetched for the section straight away. Updates in place while games are
  // live; the strip is hidden on phones (xs, which have their own section
  // score row), so it only polls from sm up.
  const sport = sectionSport(usePathname());
  const start = sport ? initial.filter((m) => m.sport === sport) : initial;
  const matches = useLiveScores(
    start,
    { mode: "list", url: `/api/scores/live?take=${TICKER_SIZE}${sport ? `&sport=${sport}` : ""}`, fetchOnStart: Boolean(sport) },
    "sm-up"
  );
  if (matches.length === 0) return null;
  // Doubled so the -50% scroll loops seamlessly.
  const doubled = [...matches, ...matches];

  return (
    <Box
      sx={{
        display: { xs: "none", sm: "block" },
        bgcolor: STRIP_BG,
        borderBottom: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes sw-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sw-ticker-track { animation: none !important; }
        }
      `}</style>
      {/* Right-edge fade so cards scroll out smoothly instead of being
          hard-clipped by the container edge. */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: 48,
          zIndex: 2,
          pointerEvents: "none",
          background: `linear-gradient(to right, rgba(233,241,236,0), ${STRIP_BG})`,
        }}
      />
      <Link href={sport ? `/scores?category=${sport}` : "/scores"} aria-label={sport ? `${categoryChipStyle(sport).label} scores` : "All scores"} style={{ position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 3, display: "flex", textDecoration: "none" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: 2,
          pr: 1.5,
          background: "linear-gradient(135deg, #2f8a5c 0%, #17512f 100%)",
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#fff", mr: 1 }} />
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: 11.5,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "primary.contrastText",
            whiteSpace: "nowrap",
          }}
        >
          {sport ? categoryChipStyle(sport).label : "Scores"}
        </Box>
      </Box>
      </Link>
      <Box
        className="sw-ticker-track"
        sx={{
          display: "flex",
          width: "max-content",
          animation: "sw-ticker-scroll 90s linear infinite",
          pl: "120px",
          "&:hover": { animationPlayState: "paused" },
        }}
      >
        {doubled.map((match, i) => (
          <MiniScoreCard key={`${match.id}-${i}`} match={match} />
        ))}
      </Box>
    </Box>
  );
}
