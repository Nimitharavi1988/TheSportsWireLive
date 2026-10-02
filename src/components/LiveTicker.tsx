"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { useLiveScores } from "./scores/useLiveScores";
import { TICKER_SIZE } from "@/lib/scores/liveUpdates";
import { MiniScoreCard } from "./scores/MiniScoreCard";
import { useDict, useLocale } from "@/lib/i18n/LocaleContext";
import { categoryLabel } from "@/lib/i18n/helpers";

// Site-wide score strip under the header, at every width. Same cards and
// ordering as the homepage panel (most important first, see
// lib/scores/priority.ts). A static snap-scrolling row, not a marquee: scores
// that move can't be read or compared. Replaces the desktop-only marquee and
// the separate phone row.
const STRIP_BG = "#e9f1ec";

// The sport of a section page (/sport/cricket, /sport/football/world-cup),
// or null elsewhere.
export function sectionSport(pathname: string | null): string | null {
  const m = pathname?.match(/^\/sport\/([a-z0-9-]+)/);
  return m ? m[1] : null;
}

// One URL for the strip and the homepage panel, so the browser shares a
// single response between them.
export function liveListUrl(sport: string | null | undefined): string {
  return `/api/scores/live?take=${TICKER_SIZE}${sport ? `&sport=${sport}` : ""}`;
}

export function LiveTicker({ initial }: { initial: ScoreMatch[] }) {
  const dict = useDict();
  const t = dict.scores;
  const locale = useLocale();
  const sportName = (s: string) => (locale ? categoryLabel(s, dict) : categoryChipStyle(s).label);
  // On a sport's section the strip shows that sport's games — the
  // server-rendered list is every sport's, so it's narrowed here and fetched
  // for the section straight away. Updates in place while games are live.
  const sport = sectionSport(usePathname());
  const start = sport ? initial.filter((m) => m.sport === sport) : initial;
  const matches = useLiveScores(start, { mode: "list", url: liveListUrl(sport), fetchOnStart: Boolean(sport) });
  const track = useRef<HTMLDivElement | null>(null);
  if (matches.length === 0) return null;
  const liveCount = matches.filter((m) => m.state === "live").length;
  const scroll = (dir: -1 | 1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <Box component="section" aria-label={t.title} sx={{ display: "flex", alignItems: "stretch", bgcolor: STRIP_BG, borderBottom: "1px solid", borderColor: "divider" }}>
      <Link
        href={sport ? `/scores?category=${sport}` : "/scores"}
        aria-label={sport ? t.sportScores(sportName(sport)) : t.allScores}
        style={{ display: "flex", textDecoration: "none", flexShrink: 0 }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", px: { xs: 1.5, sm: 2 }, background: "linear-gradient(135deg, #25774d 0%, #17512f 100%)", color: "primary.contrastText" }}>
          <Box component="span" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 12, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {sport ? sportName(sport) : t.title}
          </Box>
          {liveCount > 0 && (
            <Box component="span" sx={{ fontSize: 12, opacity: 1, whiteSpace: "nowrap" }}>
              {t.liveCount(liveCount)}
            </Box>
          )}
        </Box>
      </Link>
      <IconButton size="small" onClick={() => scroll(-1)} aria-label={t.scrollLeft} sx={{ display: { xs: "none", md: "inline-flex" }, borderRadius: 0 }}>
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <Box
        ref={track}
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x proximity",
          px: 0.6,
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "divider", borderRadius: 3 },
          "& > a": { flexShrink: 0, scrollSnapAlign: "start" },
        }}
      >
        {matches.map((match) => (
          <MiniScoreCard key={match.id} match={match} locale={locale} />
        ))}
      </Box>
      <IconButton size="small" onClick={() => scroll(1)} aria-label={t.scrollRight} sx={{ display: { xs: "none", md: "inline-flex" }, borderRadius: 0 }}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
