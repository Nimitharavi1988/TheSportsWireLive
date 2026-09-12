"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
// Table family stays a Client Component per the note in StandingsTable.tsx —
// throws "Element type is invalid" under Turbopack when rendered directly in
// a Server Component. This whole widget is already client-side for the
// arrow interactivity, so it's a non-issue here.
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import type { StandingsTable as StandingsTableData } from "@/lib/ingestion/standings";

interface League {
  code: string;
  name: string;
}

export function StandingsCarousel({
  leagues,
  initialCode,
  initialTable,
}: {
  leagues: League[];
  initialCode: string;
  initialTable: StandingsTableData;
}) {
  const [index, setIndex] = useState(leagues.findIndex((l) => l.code === initialCode));
  // Cache every league's table as it's fetched, keyed by code — flipping
  // back to a league you've already viewed this visit is instant, no refetch.
  const [cache, setCache] = useState<Record<string, StandingsTableData | null>>({
    [initialCode]: initialTable,
  });
  const [loadingCode, setLoadingCode] = useState<string | null>(null);

  const current = leagues[index];
  const table = cache[current.code];

  async function loadIfNeeded(code: string) {
    if (cache[code] !== undefined) return;
    setLoadingCode(code);
    try {
      const res = await fetch(`/api/standings/${code}`);
      const data = res.ok ? await res.json() : null;
      setCache((prev) => ({ ...prev, [code]: data }));
    } catch {
      setCache((prev) => ({ ...prev, [code]: null }));
    } finally {
      setLoadingCode(null);
    }
  }

  function go(delta: number) {
    const nextIndex = (index + delta + leagues.length) % leagues.length;
    setIndex(nextIndex);
    loadIfNeeded(leagues[nextIndex].code);
  }

  const isLoading = loadingCode === current.code;
  const rows = table?.rows.slice(0, 6) ?? [];

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
          aria-label="Previous league"
          sx={{ color: "inherit", "&:hover": { bgcolor: "rgba(29, 107, 63, 0.14)" } }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
          <EmojiEventsIcon sx={{ opacity: 0.85, fontSize: 18 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: 14 }}>
              {current.name}
            </Typography>
            <Typography sx={{ opacity: 0.75, fontSize: 10.5 }}>
              {index + 1} of {leagues.length}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          size="small"
          onClick={() => go(1)}
          aria-label="Next league"
          sx={{ color: "inherit", "&:hover": { bgcolor: "rgba(29, 107, 63, 0.14)" } }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box sx={{ p: 1.5 }}>
        {isLoading && (
          <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 2 }}>
            Loading…
          </Typography>
        )}

        {!isLoading && table && rows.length > 0 && (
          <>
            <Box sx={{ overflowX: "auto", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
              <Table size="small" sx={{ "& th, & td": { fontSize: 12, px: 1, py: 0.75 } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>P</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Pts</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.teamId}
                      sx={{
                        borderLeft: "3px solid",
                        borderLeftColor: row.position <= 4 ? "primary.main" : "transparent",
                        "&:hover": { bgcolor: "action.hover" },
                        "&:last-of-type td": { borderBottom: 0 },
                      }}
                    >
                      <TableCell>{row.position}</TableCell>
                      <TableCell sx={{ maxWidth: 120 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "nowrap" }}>
                          {row.teamCrest && (
                            <img src={row.teamCrest} alt={`${row.teamName} crest`} width={16} height={16} style={{ flexShrink: 0 }} />
                          )}
                          <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>
                            {row.teamName}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{row.playedGames}</TableCell>
                      <TableCell align="right">
                        <strong>{row.points}</strong>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mt: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Champions League spots
              </Typography>
            </Stack>
          </>
        )}

        {!isLoading && !table && (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
            Standings unavailable right now.
          </Typography>
        )}

        <Link href={`/standings/${current.code}`} style={{ textDecoration: "none" }}>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            endIcon={<ArrowForwardIcon fontSize="small" />}
            sx={{ mt: 1.5 }}
          >
            Full {current.name} table
          </Button>
        </Link>
      </Box>
    </Paper>
  );
}
