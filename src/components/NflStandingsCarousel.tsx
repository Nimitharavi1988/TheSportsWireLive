"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import type { NflConferenceStandings } from "@/lib/ingestion/nflData";

// Same header-bar-with-arrows pattern as the football StandingsCarousel, for
// visual consistency between the two — cycles between conferences (AFC/NFC)
// instead of leagues. Both conferences are fetched upfront in one call
// (fetchNflStandingsTable), unlike football's per-league on-demand fetch,
// since there are only ever two to show.
export function NflStandingsCarousel({ conferences }: { conferences: NflConferenceStandings[] }) {
  const [index, setIndex] = useState(0);

  if (conferences.length === 0) return null;
  const current = conferences[index];
  const rows = current.rows.slice(0, 7);

  function go(delta: number) {
    setIndex((i) => (i + delta + conferences.length) % conferences.length);
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
          aria-label="Previous conference"
          disabled={conferences.length < 2}
          sx={{ color: "inherit", "&:hover": { bgcolor: "rgba(29, 107, 63, 0.14)" } }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
          <EmojiEventsIcon sx={{ opacity: 0.85, fontSize: 18 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: 14 }}>
              {current.conferenceName}
            </Typography>
            <Typography sx={{ opacity: 0.75, fontSize: 10.5 }}>
              {index + 1} of {conferences.length}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          size="small"
          onClick={() => go(1)}
          aria-label="Next conference"
          disabled={conferences.length < 2}
          sx={{ color: "inherit", "&:hover": { bgcolor: "rgba(29, 107, 63, 0.14)" } }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box sx={{ p: 1.5 }}>
        {rows.length > 0 ? (
          <Box sx={{ overflowX: "auto", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
            <Table size="small" sx={{ "& th, & td": { fontSize: 12, px: 1, py: 0.75 } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700 }}>Seed</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>W</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.teamId}
                    sx={{
                      borderLeft: "3px solid",
                      borderLeftColor: row.playoffSeed > 0 && row.playoffSeed <= 7 ? "primary.main" : "transparent",
                      "&:hover": { bgcolor: "action.hover" },
                      "&:last-of-type td": { borderBottom: 0 },
                    }}
                  >
                    <TableCell>{row.playoffSeed || "—"}</TableCell>
                    <TableCell sx={{ maxWidth: 120 }}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "nowrap" }}>
                        {row.teamLogo && (
                          <img src={row.teamLogo} alt={`${row.teamName} logo`} width={16} height={16} style={{ flexShrink: 0 }} />
                        )}
                        <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>
                          {row.teamName}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{row.wins}</TableCell>
                    <TableCell align="right">{row.losses}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
            Standings unavailable right now.
          </Typography>
        )}
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mt: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Playoff seed
          </Typography>
        </Stack>
      </Box>
    </Paper>
  );
}
