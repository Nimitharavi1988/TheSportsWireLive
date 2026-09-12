import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { FullStandingsTable } from "@/components/StandingsTable";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

export const revalidate = 300;

export async function generateMetadata(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return {};
  const table = await fetchStandingsTable(apiKey, params.code.toUpperCase());
  if (!table) return {};
  return { title: `${table.competitionName} Standings`, alternates: { canonical: `/standings/${params.code.toUpperCase()}` } };
}

export default async function StandingsPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) notFound();

  const table = await fetchStandingsTable(apiKey, params.code.toUpperCase());
  if (!table || table.rows.length === 0) notFound();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <EmojiEventsIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4">
          {table.competitionName} Standings
        </Typography>
      </Stack>
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
