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
import { getDict } from "@/lib/i18n/dictionary";

export async function leagueMetadata(code: string, locale?: string) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return {};
  const table = await fetchStandingsTable(apiKey, code.toUpperCase());
  if (!table) return {};
  return { title: getDict(locale).standings.leagueTitle(table.competitionName), alternates: { canonical: `/standings/${code.toUpperCase()}` } };
}

// One football league's full table, English or a language edition.
export async function StandingsLeagueView({ code, locale }: { code: string; locale?: string }) {
  const params = { code };
  const t = getDict(locale);
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) notFound();

  const table = await fetchStandingsTable(apiKey, params.code.toUpperCase());
  if (!table || table.rows.length === 0) notFound();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <EmojiEventsIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4">
          {t.standings.leagueTitle(table.competitionName)}
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
      <FullStandingsTable code={params.code.toUpperCase()} title={table.competitionName} rows={table.rows} />
    </Container>
  );
}
