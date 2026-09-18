"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import { StatusBadge, type LiveMatchRow } from "./LiveScorecard";
import { categoryChipStyle } from "@/lib/categoryDisplay";

function TeamRow({ crest, name, scoreText, category }: { crest: string | null; name: string | null; scoreText: string | null; category: string }) {
  // Same fix as LiveScorecard.tsx's own TeamRow — "yet to bat" is a real
  // cricket concept, not a generic "match hasn't produced a score yet"
  // placeholder, and this widget now covers every sport.
  const noScoreLabel = category === "cricket" ? "yet to bat" : "—";
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {crest && <Image src={crest} alt="" width={26} height={26} style={{ flexShrink: 0 }} />}
      <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
        {name ?? "—"}
      </Typography>
      <Typography
        sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, color: scoreText ? "text.primary" : "text.secondary" }}
      >
        {scoreText ?? noScoreLabel}
      </Typography>
    </Stack>
  );
}

// Same header-bar-with-arrows pattern as StandingsCarousel, so the two
// widgets read as part of the same design system rather than one-off
// styles — cycles through matches already fetched server-side (no on-demand
// fetch needed here, unlike StandingsCarousel's per-league API calls,
// since every live match is cheap enough to pass down in one query).
export function LiveScoreboardCarousel({ matches }: { matches: LiveMatchRow[] }) {
  const [index, setIndex] = useState(0);

  if (matches.length === 0) return null;

  const current = matches[index];

  function go(delta: number) {
    setIndex((prev) => (prev + delta + matches.length) % matches.length);
  }

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 1.25,
          bgcolor: "rgba(29, 107, 63, 0.08)",
          borderBottom: "1px solid",
          borderColor: "divider",
          color: "primary.main",
        }}
      >
        <IconButton
          size="small"
          onClick={() => go(-1)}
          aria-label="Previous live match"
          disabled={matches.length < 2}
          sx={{ color: "inherit", "&:hover": { bgcolor: "rgba(29, 107, 63, 0.14)" } }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
          <ScoreboardIcon sx={{ opacity: 0.85, fontSize: 18 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: 14 }}>
              {current.matchState === "live" ? "Live Now" : "Scores"}
            </Typography>
            <Typography sx={{ opacity: 0.75, fontSize: 10.5 }}>
              {index + 1} of {matches.length}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          size="small"
          onClick={() => go(1)}
          aria-label="Next live match"
          disabled={matches.length < 2}
          sx={{ color: "inherit", "&:hover": { bgcolor: "rgba(29, 107, 63, 0.14)" } }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Main match link and "More on this match" links go to different
          articles, so they're separate <Link>s rather than one nested
          inside the other (invalid HTML). */}
      <Link href={`/article/${current.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
        <Box sx={{ p: 1.5, "&:hover": { bgcolor: "action.hover" } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <StatusBadge state={current.matchState} kickoffAt={current.kickoffAt} />
            {/* Which sport, now that this carousel cycles through all of
                them together, not just cricket. */}
            <Typography
              variant="caption"
              sx={{ color: categoryChipStyle(current.category).color, fontWeight: 700, letterSpacing: "0.03em" }}
            >
              {categoryChipStyle(current.category).label}
            </Typography>
          </Stack>
          {current.isNewsDerived ? (
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>
              {current.homeTeam} vs {current.awayTeam}
            </Typography>
          ) : (
            <Stack spacing={0.5} sx={{ mb: 1 }}>
              <TeamRow crest={current.homeCrestUrl} name={current.homeTeam} scoreText={current.homeScoreText} category={current.category} />
              <TeamRow crest={current.awayCrestUrl} name={current.awayTeam} scoreText={current.awayScoreText} category={current.category} />
            </Stack>
          )}
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontSize: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {current.summary}
          </Typography>
        </Box>
      </Link>
      {current.relatedArticles && current.relatedArticles.length > 0 && (
        <Box sx={{ px: 1.5, pb: 1.5, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: "text.secondary", mb: 0.5, textTransform: "uppercase", letterSpacing: 0.3 }}>
            More on this match
          </Typography>
          <Stack spacing={0.4}>
            {current.relatedArticles.map((a) => (
              <Link key={a.id} href={`/article/${a.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Typography
                  sx={{ fontSize: 11.5, "&:hover": { color: "primary.main" }, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}
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
