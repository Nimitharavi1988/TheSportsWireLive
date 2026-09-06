import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { FullStandingsTable } from "@/components/StandingsTable";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";

export const revalidate = 300;

export async function generateMetadata(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return {};
  const table = await fetchStandingsTable(apiKey, params.code.toUpperCase());
  if (!table) return {};
  return { title: `${table.competitionName} Standings` };
}

export default async function StandingsPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
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
              variant={league.code === params.code.toUpperCase() ? "filled" : "outlined"}
              sx={{
                color: league.code === params.code.toUpperCase() ? "primary" : "default"
              }}
            />
          </Link>
        ))}
      </Box>
      <FullStandingsTable rows={table.rows} />
    </Container>
  );
}
