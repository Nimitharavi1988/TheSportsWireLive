"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import type { LiveMatchRow } from "./LiveScorecard";

function TeamRow({ crest, name, scoreText }: { crest: string | null; name: string | null; scoreText: string | null }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {crest && <img src={crest} alt="" width={26} height={26} style={{ flexShrink: 0 }} />}
      <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
        {name ?? "—"}
      </Typography>
      <Typography
        sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, color: scoreText ? "text.primary" : "text.secondary" }}
      >
        {scoreText ?? "yet to bat"}
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
          <SportsCricketIcon sx={{ opacity: 0.85, fontSize: 18 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: 14 }}>
              Live Cricket
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

      <Link href={`/article/${current.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
        <Box sx={{ p: 1.5, "&:hover": { bgcolor: "action.hover" } }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
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
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            <TeamRow crest={current.homeCrestUrl} name={current.homeTeam} scoreText={current.homeScoreText} />
            <TeamRow crest={current.awayCrestUrl} name={current.awayTeam} scoreText={current.awayScoreText} />
          </Stack>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontSize: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {current.summary}
          </Typography>
        </Box>
      </Link>
    </Paper>
  );
}
