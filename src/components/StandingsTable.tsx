"use client";

// Extracted into its own Client Component as a workaround for a real bug hit
// during the Next.js 16 upgrade: MUI's Table/TableHead/TableBody/TableRow/
// TableCell family renders fine in Client Components but throws "Element
// type is invalid" when rendered directly inside a Server Component under
// Turbopack (matches a known Next.js RSC + Turbopack module-resolution bug
// class — vercel/next.js#75192/#84961: works in Client Components, breaks in
// Server Components). Every other MUI component (Stack, Typography, Card,
// Chip, etc.) rendered fine directly in Server Components in this app — this
// bug is specific to the Table family.
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { StandingsTableRow } from "@/lib/ingestion/standings";

export function CompactStandingsTable({ rows }: { rows: StandingsTableRow[] }) {
  return (
    <Paper variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Team</TableCell>
            <TableCell align="right">P</TableCell>
            <TableCell align="right">Pts</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.teamId}>
              <TableCell>{row.position}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  {row.teamCrest && <img src={row.teamCrest} alt={`${row.teamName} crest`} width={20} height={20} />}
                  <Typography variant="body2">{row.teamName}</Typography>
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
    </Paper>
  );
}

export function FullStandingsTable({ rows }: { rows: StandingsTableRow[] }) {
  return (
    <Paper variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Team</TableCell>
            <TableCell align="right">P</TableCell>
            <TableCell align="right">W</TableCell>
            <TableCell align="right">D</TableCell>
            <TableCell align="right">L</TableCell>
            <TableCell align="right">GF</TableCell>
            <TableCell align="right">GA</TableCell>
            <TableCell align="right">GD</TableCell>
            <TableCell align="right">Pts</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.teamId}>
              <TableCell>{row.position}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  {row.teamCrest && <img src={row.teamCrest} alt={`${row.teamName} crest`} width={20} height={20} />}
                  <Typography variant="body2">{row.teamName}</Typography>
                </Stack>
              </TableCell>
              <TableCell align="right">{row.playedGames}</TableCell>
              <TableCell align="right">{row.won}</TableCell>
              <TableCell align="right">{row.draw}</TableCell>
              <TableCell align="right">{row.lost}</TableCell>
              <TableCell align="right">{row.goalsFor}</TableCell>
              <TableCell align="right">{row.goalsAgainst}</TableCell>
              <TableCell align="right">{row.goalDifference}</TableCell>
              <TableCell align="right">
                <strong>{row.points}</strong>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
