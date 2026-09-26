"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

// The one standings widget design, in the same visual language as the score
// cards (src/components/scores/): outlined card, bold 15px heading, 20px
// crests, 14px team rows with tabular numbers, muted 12px labels. Replaced
// five near-identical copies (football + NFL/NBA/MLB/NHL), each with its own
// tinted header and 12px MUI table that didn't match the scores section.
// Presentational only — callers own which group is shown and any loading.

export interface StandingsColumn {
  label: string;
  // The column that decides the order (points / wins) — shown bold.
  strong?: boolean;
}

export interface StandingsRow {
  id: string;
  position: number | string;
  name: string;
  logo: string | null;
  values: (number | string)[];
  // In a qualifying/playoff place (marked by the accent bar + legend).
  qualified: boolean;
}

const COL_WIDTH = 34;

export function StandingsCard({
  title,
  groupLabel,
  onPrev,
  onNext,
  switchLabel,
  columns,
  rows,
  loading = false,
  legend,
  footer,
}: {
  title: string;
  // "1 of 2" when there are several tables to switch between.
  groupLabel?: string;
  onPrev?: () => void;
  onNext?: () => void;
  // What the arrows switch ("conference", "league") for screen readers.
  switchLabel: string;
  columns: StandingsColumn[];
  rows: StandingsRow[];
  loading?: boolean;
  legend?: string;
  footer?: ReactNode;
}) {
  const grid = `22px minmax(0, 1fr) repeat(${columns.length}, ${COL_WIDTH}px)`;
  return (
    <Box component="section" aria-label={`${title} standings`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", p: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
        <EmojiEventsIcon sx={{ fontSize: 18, color: "primary.main" }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" noWrap sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>
            {title}
          </Typography>
          {groupLabel && <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.2 }}>{groupLabel}</Typography>}
        </Box>
        {onPrev && (
          <IconButton size="small" onClick={onPrev} aria-label={`Previous ${switchLabel}`}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
        {onNext && (
          <IconButton size="small" onClick={onNext} aria-label={`Next ${switchLabel}`}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {loading ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center", py: 3 }}>Loading…</Typography>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 2 }}>Standings unavailable right now.</Typography>
      ) : (
        <Box role="table" aria-label={`${title} table`}>
          <Box
            role="row"
            sx={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", gap: 0.75, pb: 0.5, borderBottom: "1px solid", borderColor: "divider", fontSize: 12, fontWeight: 600, color: "text.secondary" }}
          >
            <span role="columnheader">#</span>
            <span role="columnheader">Team</span>
            {columns.map((c) => (
              <Box component="span" role="columnheader" key={c.label} sx={{ textAlign: "right" }}>
                {c.label}
              </Box>
            ))}
          </Box>
          {rows.map((row) => (
            <Box
              role="row"
              key={row.id}
              sx={{
                display: "grid",
                gridTemplateColumns: grid,
                alignItems: "center",
                gap: 0.75,
                minHeight: 32,
                fontSize: 14,
                fontVariantNumeric: "tabular-nums",
                borderBottom: "1px solid",
                borderColor: "divider",
                "&:last-of-type": { borderBottom: 0 },
              }}
            >
              <Box
                component="span"
                role="cell"
                sx={{
                  fontSize: 13,
                  color: "text.secondary",
                  pl: 0.75,
                  boxShadow: row.qualified ? (t) => `inset 3px 0 0 ${t.palette.primary.main}` : "none",
                }}
              >
                {row.position}
              </Box>
              <Box component="span" role="cell" sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                {row.logo ? (
                  <Image src={row.logo} alt="" width={20} height={20} style={{ objectFit: "contain", flexShrink: 0 }} />
                ) : (
                  <Box component="span" sx={{ width: 20, flexShrink: 0 }} />
                )}
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                  {row.name}
                </Box>
              </Box>
              {row.values.map((v, i) => (
                <Box component="span" role="cell" key={columns[i]?.label ?? i} sx={{ textAlign: "right", fontWeight: columns[i]?.strong ? 700 : 500 }}>
                  {v}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )}

      {legend && !loading && rows.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1, fontSize: 12, color: "text.secondary" }}>
          <Box aria-hidden sx={{ width: 3, height: 12, borderRadius: 1, bgcolor: "primary.main" }} />
          {legend}
        </Box>
      )}
      {footer && <Box sx={{ mt: 1 }}>{footer}</Box>}
    </Box>
  );
}
