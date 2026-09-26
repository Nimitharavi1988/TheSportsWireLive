"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

// The one standings design, modelled on Google's sports tables: a titled
// card, a plain table with hairline row dividers, small grey column labels,
// the deciding column (points / wins) in bold, and a colored bar at the
// start of each row in a table zone (Champions League, playoffs,
// relegation) with a legend underneath. Used by every standings display —
// sidebar widgets (compact) and the full /standings pages (`full`, which
// scrolls sideways on a phone with rank + club kept in view).
// Presentational only: callers own which table is shown and loading.

export interface StandingsColumn {
  label: string;
  // The column that decides the order — shown bold.
  strong?: boolean;
}

export interface StandingsLegendZone {
  key: string;
  label: string;
  color: string;
}

export interface StandingsRow {
  id: string;
  position: number | string;
  name: string;
  logo: string | null;
  values: (number | string)[];
  // The zone this place is in (a key of `zones`), if any.
  zone?: string;
}

export function StandingsCard({
  title,
  groupLabel,
  onPrev,
  onNext,
  switchLabel,
  columns,
  rows,
  zones = [],
  loading = false,
  full = false,
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
  zones?: StandingsLegendZone[];
  loading?: boolean;
  full?: boolean;
  footer?: ReactNode;
}) {
  const zoneColor = new Map(zones.map((z) => [z.key, z.color]));
  const usedZones = zones.filter((z) => rows.some((r) => r.zone === z.key));
  const colWidth = full ? 40 : 28;
  const cell = { px: 0.5, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
  // Rank + club stay in view when a full table scrolls sideways.
  const sticky = full ? { position: "sticky" as const, bgcolor: "background.paper", zIndex: 1 } : {};

  return (
    <Box component="section" aria-label={`${title} standings`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" noWrap sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
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
        <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center", py: 4 }}>Loading…</Typography>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", px: 2, py: 3 }}>Standings unavailable right now.</Typography>
      ) : (
        <Box sx={{ overflowX: full ? "auto" : "visible" }}>
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: full ? 14 : 13, "& td, & th": { py: 1 } }}>
            <thead>
              <Box component="tr" sx={{ color: "text.secondary", fontSize: 12, "& th": { fontWeight: 500 } }}>
                <Box component="th" scope="col" sx={{ ...sticky, left: 0, textAlign: "left", pl: 2, pr: 0.5, width: 28 }}>#</Box>
                <Box component="th" scope="col" sx={{ ...sticky, left: 28 + 16, textAlign: "left", px: 0.5 }}>{full ? "Club" : "Team"}</Box>
                {columns.map((c, i) => (
                  <Box component="th" scope="col" key={c.label} sx={{ ...cell, width: colWidth, pr: i === columns.length - 1 ? 2 : 0.5 }}>
                    {c.label}
                  </Box>
                ))}
              </Box>
            </thead>
            <tbody>
              {rows.map((row) => {
                const color = row.zone ? zoneColor.get(row.zone) : undefined;
                return (
                  <Box component="tr" key={row.id} sx={{ borderTop: "1px solid", borderColor: "divider" }}>
                    <Box
                      component="td"
                      sx={{ ...sticky, left: 0, pl: 2, pr: 0.5, color: "text.secondary", boxShadow: color ? `inset 3px 0 0 ${color}` : "none" }}
                    >
                      {row.position}
                    </Box>
                    <Box component="td" sx={{ ...sticky, left: 28 + 16, px: 0.5, maxWidth: full ? 220 : 0, width: full ? undefined : "100%" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, maxWidth: full ? { xs: 130, sm: 240 } : "none" }}>
                        {row.logo ? (
                          <Image src={row.logo} alt="" width={18} height={18} style={{ objectFit: "contain", flexShrink: 0 }} />
                        ) : (
                          <Box component="span" sx={{ width: 18, flexShrink: 0 }} />
                        )}
                        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.name}
                        </Box>
                      </Box>
                    </Box>
                    {row.values.map((v, i) => (
                      <Box component="td" key={columns[i]?.label ?? i} sx={{ ...cell, fontWeight: columns[i]?.strong ? 700 : 400, pr: i === row.values.length - 1 ? 2 : 0.5 }}>
                        {v}
                      </Box>
                    ))}
                  </Box>
                );
              })}
            </tbody>
          </Box>
        </Box>
      )}

      {usedZones.length > 0 && !loading && (
        <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 2, rowGap: 0.5, px: 2, py: 1, borderTop: "1px solid", borderColor: "divider", fontSize: 12, color: "text.secondary" }}>
          {usedZones.map((z) => (
            <Box key={z.key} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
              <Box component="span" aria-hidden sx={{ width: 3, height: 12, bgcolor: z.color }} />
              {z.label}
            </Box>
          ))}
        </Box>
      )}
      {footer && <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>{footer}</Box>}
    </Box>
  );
}
