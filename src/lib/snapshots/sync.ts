/**
 * Refreshes stored copies of third-party tables (see snapshots/read.ts) —
 * run with each ingestion (ingest-cron.yml, its own step). A fetch that
 * fails or comes back empty keeps the previous copy, so a provider hiccup
 * never blanks a table on the site.
 */
import { db } from "@/db";
import { dataSnapshot } from "@/db/schema";
import { fetchNflStandingsTable } from "../ingestion/nflData";
import { fetchNbaStandingsTable } from "../ingestion/nbaData";
import { fetchMlbStandingsTable } from "../ingestion/mlbData";
import { fetchNhlStandingsTable } from "../ingestion/nhlData";
import { fetchCricketStandings } from "../events/cricketStandings";
import { EVENT_HUBS } from "../events/eventHubs";
import { SNAPSHOT_KEYS } from "./read";

type SnapshotSource = { key: string; sourceUrl: string; load: () => Promise<unknown[] | null> };

function sources(): SnapshotSource[] {
  const espn = (path: string) => `https://site.api.espn.com/apis/v2/sports/${path}/standings`;
  const list: SnapshotSource[] = [
    { key: SNAPSHOT_KEYS.nflStandings, sourceUrl: espn("football/nfl"), load: fetchNflStandingsTable },
    { key: SNAPSHOT_KEYS.nbaStandings, sourceUrl: espn("basketball/nba"), load: fetchNbaStandingsTable },
    { key: SNAPSHOT_KEYS.mlbStandings, sourceUrl: espn("baseball/mlb"), load: fetchMlbStandingsTable },
    { key: SNAPSHOT_KEYS.nhlStandings, sourceUrl: espn("hockey/nhl"), load: fetchNhlStandingsTable },
  ];
  for (const hub of Object.values(EVENT_HUBS)) {
    for (const s of hub.cricketStandings ?? []) {
      list.push({ key: SNAPSHOT_KEYS.cricketStandings(s.espnLeagueId), sourceUrl: espn(`cricket/${s.espnLeagueId}`), load: () => fetchCricketStandings(s.espnLeagueId) });
    }
  }
  return list;
}

export async function syncSnapshots(): Promise<void> {
  for (const s of sources()) {
    try {
      const data = await s.load();
      if (!data || data.length === 0) {
        console.warn(`[snapshots] ${s.key}: nothing fetched — kept previous copy`);
        continue;
      }
      await db.insert(dataSnapshot)
        .values({ key: s.key, data, sourceUrl: s.sourceUrl, fetchedAt: new Date() })
        .onConflictDoUpdate({ target: dataSnapshot.key, set: { data, sourceUrl: s.sourceUrl, fetchedAt: new Date() } });
      console.log(`[snapshots] ${s.key}: ${data.length} groups`);
    } catch (err) {
      console.error(`[snapshots] ${s.key} failed:`, err);
    }
  }
}

if (require.main === module) {
  syncSnapshots().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
