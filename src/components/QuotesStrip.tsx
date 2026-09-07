"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { PlayerQuote } from "@/lib/quotes";

const PLAYER_AVATAR_COLORS = ["#1d6b3f", "#b8752e", "#3d5a73"];

function playerInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const AUTO_ADVANCE_MS = 6000;

// Compact sidebar card — this is supplementary/editorial content, not real
// news, so it deliberately carries much less visual weight than Player News
// or Transfers & Big News: no section heading (the single small corner quote
// mark is identifier enough), smaller type, no left/right IconButtons eating
// into a ~240px-wide rail. Same reliable index-based rotation as Standings.
export function QuotesStrip({ quotes }: { quotes: PlayerQuote[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % quotes.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [quotes.length]);

  if (quotes.length === 0) return null;
  const current = quotes[index];

  function go(delta: number) {
    setIndex((i) => (i + delta + quotes.length) % quotes.length);
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        // Fixed floor so the card doesn't visibly resize as it rotates
        // between a short quote and a long one — measured live across all 6
        // quotes (210px to 233px) after adding the literal quotation marks.
        minHeight: 233,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Literal quotation marks around the text, not an icon — an icon
          reads as decoration, not as "this is a quotation," which is the
          actual point. */}
      <Typography sx={{ fontSize: 13, lineHeight: 1.45, fontStyle: "italic", flex: 1 }}>
        &ldquo;{current.quote}&rdquo;
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1.5 }}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: PLAYER_AVATAR_COLORS[index % PLAYER_AVATAR_COLORS.length],
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {playerInitials(current.name)}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" noWrap sx={{ fontWeight: 700, lineHeight: 1.2, display: "block" }}>
            {current.name}
          </Typography>
          {current.context && (
            <Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block", fontSize: 10.5 }}>
              {current.context}
            </Typography>
          )}
        </Box>
      </Stack>

      {quotes.length > 1 && (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", justifyContent: "center", mt: 1.5 }}>
          <IconButton size="small" onClick={() => go(-1)} aria-label="Previous quote">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Stack direction="row" spacing={0.5}>
            {quotes.map((q, i) => (
              <Box
                key={q.name}
                onClick={() => setIndex(i)}
                sx={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  bgcolor: i === index ? "primary.main" : "divider",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
              />
            ))}
          </Stack>
          <IconButton size="small" onClick={() => go(1)} aria-label="Next quote">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
    </Paper>
  );
}
