import Box from "@mui/material/Box";
import { EVENT_HUBS } from "@/lib/events/eventHubs";
import { getFreshMedalTable } from "@/lib/events/queries";
import { MedalTableCard } from "./MedalTableCard";

// Compact medal table for the homepage while a multi-sport Games is on: the
// top five plus India (the site's audience), linking to the full table on the
// event's page. Shown only for an event whose table is current — one synced
// in the last three days — so it disappears by itself when the Games end and
// the sync stops. Failures just hide it.
const FRESH_MS = 3 * 24 * 60 * 60 * 1000;

export async function HomeMedals() {
  const hubs = Object.values(EVENT_HUBS).filter((h) => h.medalTable);
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
