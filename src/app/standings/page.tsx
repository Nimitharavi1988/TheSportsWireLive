import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import type { NflConferenceStandings } from "@/lib/ingestion/nflData";
import type { NbaConferenceStandings } from "@/lib/ingestion/nbaData";
import type { MlbConferenceStandings } from "@/lib/ingestion/mlbData";
import type { NhlConferenceStandings } from "@/lib/ingestion/nhlData";
import { SNAPSHOT_KEYS, readSnapshot } from "@/lib/snapshots/read";
import { NflStandingsCarousel } from "@/components/NflStandingsCarousel";
import { NbaStandingsCarousel } from "@/components/NbaStandingsCarousel";
import { MlbStandingsCarousel } from "@/components/MlbStandingsCarousel";
import { NhlStandingsCarousel } from "@/components/NhlStandingsCarousel";

// Standings change daily; was static since the last deploy (no revalidate).
export const revalidate = 3600;

export const metadata = {
  title: "League Standings — Football, NFL, NBA, MLB, NHL",
  description: "Current league tables and playoff standings for football, the NFL, NBA, MLB and NHL on Sports Wire Live.",
  alternates: { canonical: "/standings" },
};

const FULL_ROWS = 32;

async function snapshot<T>(key: string): Promise<T[]> {
  try {
    return (await readSnapshot<T[]>(key)) ?? [];
  } catch {
    return [];
  }
}

export default async function StandingsIndexPage() {
  const [nfl, nba, mlb, nhl] = await Promise.all([
    snapshot<NflConferenceStandings>(SNAPSHOT_KEYS.nflStandings),
    snapshot<NbaConferenceStandings>(SNAPSHOT_KEYS.nbaStandings),
    snapshot<MlbConferenceStandings>(SNAPSHOT_KEYS.mlbStandings),
    snapshot<NhlConferenceStandings>(SNAPSHOT_KEYS.nhlStandings),
  ]);
  // Only sports that have a table right now.
  const sections = [
    { id: "football", label: "Football", node: null as React.ReactNode },
    ...(nfl.length ? [{ id: "nfl", label: "NFL", node: <NflStandingsCarousel conferences={nfl} maxRows={FULL_ROWS} /> }] : []),
    ...(nba.length ? [{ id: "nba", label: "NBA", node: <NbaStandingsCarousel conferences={nba} maxRows={FULL_ROWS} /> }] : []),
    ...(mlb.length ? [{ id: "mlb", label: "MLB", node: <MlbStandingsCarousel conferences={mlb} maxRows={FULL_ROWS} /> }] : []),
    ...(nhl.length ? [{ id: "nhl", label: "NHL", node: <NhlStandingsCarousel conferences={nhl} maxRows={FULL_ROWS} /> }] : []),
  ];
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        League Standings
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: "text.secondary",
          mb: 3
        }}>
        Tables for every sport we cover.
      </Typography>
      <Box component="nav" aria-label="Sports" sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
        {sections.map((sec) => (
          <a key={sec.id} href={"#" + sec.id} style={{ textDecoration: "none" }}>
            <Box component="span" sx={{ display: "inline-block", px: 1.75, py: 0.6, borderRadius: 5, fontSize: 14, fontWeight: 600, border: "1px solid", borderColor: "divider", color: "text.secondary", "&:hover": { borderColor: "text.secondary", color: "text.primary" } }}>
              {sec.label}
            </Box>
          </a>
        ))}
      </Box>
      <Typography id="football" variant="h5" component="h2" sx={{ mb: 1.5, scrollMarginTop: 90 }}>Football</Typography>
      <Stack spacing={1.25}>
        {STANDINGS_LEAGUES.map((league) => (
          <Link key={league.code} href={`/standings/${league.code}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                transition: "border-color 0.15s, background-color 0.15s",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(29, 107, 63, 0.08)",
                }}
              >
                <EmojiEventsIcon sx={{ color: "primary.main", fontSize: 20 }} />
              </Box>
              <Typography variant="h6" sx={{ flex: 1 }}>
                {league.name}
              </Typography>
              <ChevronRightIcon sx={{ color: "text.secondary" }} />
            </Paper>
          </Link>
        ))}
      </Stack>
      {sections.filter((sec) => sec.node).map((sec) => (
        <Box key={sec.id} sx={{ mt: 5 }}>
          <Typography id={sec.id} variant="h5" component="h2" sx={{ mb: 1.5, scrollMarginTop: 90 }}>{sec.label}</Typography>
          {sec.node}
        </Box>
      ))}
    </Container>
  );
}
