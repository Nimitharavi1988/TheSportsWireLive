import Box from "@mui/material/Box";
import { EVENT_HUBS } from "@/lib/events/eventHubs";
import { getFreshMedalTable } from "@/lib/events/queries";
import { isEventOver } from "@/lib/events/eventOver";
import { MedalTableCard } from "./MedalTableCard";

// Compact medal table for the homepage while a multi-sport Games is on: the
// top five plus India (the site's audience), linking to the full table on the
// event's page. Shown only while the Games are on (and two days after, for the
// final table): the event's season end is the rule (eventOver.ts). Until
// 2026-10-15 it relied on the table having been synced in the last three days,
// but the sync keeps running, so the Asian Games card stayed up long after the
// Games ended. The freshness check stays as a second guard. Failures just hide it.
const FRESH_MS = 3 * 24 * 60 * 60 * 1000;

export async function HomeMedals() {
  const hubs = Object.values(EVENT_HUBS).filter((h) => h.medalTable && !isEventOver(h.eventKey));
  const tables = await Promise.all(hubs.map((h) => getFreshMedalTable(h.eventKey, FRESH_MS).catch(() => null)));
  return (
    <>
      {hubs.map((hub, i) => {
        const medals = tables[i];
        if (!medals) return null;
        return (
          <Box key={hub.eventKey} sx={{ mb: 3 }}>
            <MedalTableCard title={`${hub.label} medal table`} medals={medals} limit={5} pin="India" href={`/series/${hub.eventKey}`} />
          </Box>
        );
      })}
    </>
  );
}
