import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import type { NflConferenceStandings } from "@/lib/ingestion/nflData";
import type { NbaConferenceStandings } from "@/lib/ingestion/nbaData";
import type { MlbConferenceStandings } from "@/lib/ingestion/mlbData";
import type { NhlConferenceStandings } from "@/lib/ingestion/nhlData";
import { SNAPSHOT_KEYS, readSnapshot } from "@/lib/snapshots/read";
import { StandingsCarousel } from "../StandingsCarousel";
import { NflStandingsCarousel } from "../NflStandingsCarousel";
import { NbaStandingsCarousel } from "../NbaStandingsCarousel";
import { MlbStandingsCarousel } from "../MlbStandingsCarousel";
import { NhlStandingsCarousel } from "../NhlStandingsCarousel";
import { SportTabs } from "./SportTabs";
import { getDict } from "@/lib/i18n/dictionary";
import { categoryLabel } from "@/lib/i18n/helpers";

// Standings for the homepage and sport sections, one design (StandingsCard)
// for every sport. "All" gets a tab per sport that has data; a sport page
// shows just that sport. Sports with no table (cricket, volleyball) simply
// don't appear — never an empty card.
type Key = "football" | "american-football" | "basketball" | "baseball" | "hockey";
const LABELS: Record<Key, string> = { football: "Football", "american-football": "NFL", basketball: "NBA", baseball: "MLB", hockey: "NHL" };
const ORDER: Key[] = ["football", "american-football", "basketball", "baseball", "hockey"];

async function build(key: Key, footballKey?: string): Promise<ReactNode | null> {
  switch (key) {
    case "football": {
      if (!footballKey) return null;
      const t = await fetchStandingsTable(footballKey, "PL");
      return t && t.rows.length > 0 ? <StandingsCarousel leagues={STANDINGS_LEAGUES} initialCode="PL" initialTable={t} /> : null;
    }
    case "american-football": {
      const d = await readSnapshot<NflConferenceStandings[]>(SNAPSHOT_KEYS.nflStandings);
      return d && d.length > 0 ? <NflStandingsCarousel conferences={d} /> : null;
    }
    case "basketball": {
      const d = await readSnapshot<NbaConferenceStandings[]>(SNAPSHOT_KEYS.nbaStandings);
      return d && d.length > 0 ? <NbaStandingsCarousel conferences={d} /> : null;
    }
    case "baseball": {
      const d = await readSnapshot<MlbConferenceStandings[]>(SNAPSHOT_KEYS.mlbStandings);
      return d && d.length > 0 ? <MlbStandingsCarousel conferences={d} /> : null;
    }
    case "hockey": {
      const d = await readSnapshot<NhlConferenceStandings[]>(SNAPSHOT_KEYS.nhlStandings);
      return d && d.length > 0 ? <NhlStandingsCarousel conferences={d} /> : null;
    }
  }
}

export async function HomeStandings({ sport, footballApiKey, locale }: { sport?: string; footballApiKey?: string; locale?: string }) {
  const t = getDict(locale);
  // A language edition lists only the sports it covers.
  const edition = locale ? ORDER.filter((k) => t.sports.some((s) => s.category === k)) : ORDER;
  const keys = sport ? edition.filter((k) => k === sport) : edition;
  if (keys.length === 0) return null;
  const nodes = await Promise.all(keys.map((k) => build(k, footballApiKey).catch(() => null)));
  const tabs = keys.flatMap((k, i) => (nodes[i] ? [{ key: k, label: locale ? categoryLabel(k, t) : LABELS[k], node: nodes[i] }] : []));
  if (tabs.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <SportTabs tabs={tabs} />
    </Box>
  );
}
