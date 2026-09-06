import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { code: string } }) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return {};
  const table = await fetchStandingsTable(apiKey, params.code.toUpperCase());
  if (!table) return {};
  return { title: `${table.competitionName} Standings` };
}

export default async function StandingsPage({ params }: { params: { code: string } }) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) notFound();

  const table = await fetchStandingsTable(apiKey, params.code.toUpperCase());
  if (!table || table.rows.length === 0) notFound();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {table.competitionName} Standings
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
        {STANDINGS_LEAGUES.map((league) => (
          <Link key={league.code} href={`/standings/${league.code}`} style={{ textDecoration: "none" }}>
            <Chip
              label={league.name}
              clickable
              color={league.code === params.code.toUpperCase() ? "primary" : "default"}
              variant={league.code === params.code.toUpperCase() ? "filled" : "outlined"}
            />
          </Link>
        ))}
      </Box>
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
            {table.rows.map((row) => (
              <TableRow key={row.teamId}>
                <TableCell>{row.position}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
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
    </Container>
  );
}
