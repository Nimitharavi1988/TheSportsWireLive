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
import { getDict } from "@/lib/i18n/dictionary";
import { categoryLabel } from "@/lib/i18n/helpers";

export function standingsMetadata(locale?: string) {
  const t = getDict(locale).standings;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/standings" } };
}

const FULL_ROWS = 32;

async function snapshot<T>(key: string): Promise<T[]> {
  try {
    return (await readSnapshot<T[]>(key)) ?? [];
  } catch {
    return [];
  }
}

// League tables for English or a language edition (only the sports it covers).
export async function StandingsView({ locale }: { locale?: string }) {
  const t = getDict(locale);
  const covers = (category: string) => !locale || t.sports.some((s) => s.category === category);
  const label = (category: string, english: string) => (locale ? categoryLabel(category, t) : english);
  const [nfl, nba, mlb, nhl] = await Promise.all([
    snapshot<NflConferenceStandings>(SNAPSHOT_KEYS.nflStandings),
    snapshot<NbaConferenceStandings>(SNAPSHOT_KEYS.nbaStandings),
    snapshot<MlbConferenceStandings>(SNAPSHOT_KEYS.mlbStandings),
    snapshot<NhlConferenceStandings>(SNAPSHOT_KEYS.nhlStandings),
  ]);
  // Only sports that have a table right now.
  const sections = [
    { id: "football", label: label("football", "Football"), node: null as React.ReactNode },
    ...(nfl.length && covers("american-football") ? [{ id: "nfl", label: label("american-football", "NFL"), node: <NflStandingsCarousel conferences={nfl} maxRows={FULL_ROWS} /> }] : []),
    ...(nba.length && covers("basketball") ? [{ id: "nba", label: label("basketball", "NBA"), node: <NbaStandingsCarousel conferences={nba} maxRows={FULL_ROWS} /> }] : []),
    ...(mlb.length && covers("baseball") ? [{ id: "mlb", label: label("baseball", "MLB"), node: <MlbStandingsCarousel conferences={mlb} maxRows={FULL_ROWS} /> }] : []),
    ...(nhl.length && covers("hockey") ? [{ id: "nhl", label: label("hockey", "NHL"), node: <NhlStandingsCarousel conferences={nhl} maxRows={FULL_ROWS} /> }] : []),
  ];
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t.standings.title}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: "text.secondary",
          mb: 3
        }}>
        {t.standings.subtitle}
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
      <Typography id="football" variant="h5" component="h2" sx={{ mb: 1.5, scrollMarginTop: 90 }}>{label("football", "Football")}</Typography>
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
