/**
 * Refreshes event medal tables (eventHubs.ts) into the EventData table —
 * run with each ingestion (.github/workflows/ingest-cron.yml, its own
 * step). Each snapshot is checked (medalTable.ts) against itself and the
 * last accepted one; a failed check keeps the last good table and logs
 * why, so a bad Wikipedia edit never reaches the site.
 */
import { db } from "@/db";
import { eventData } from "@/db/schema";
import { eq } from "drizzle-orm";
import { EVENT_HUBS } from "./eventHubs";
import { medalTableProblem, parseMedalTable, type MedalTable } from "./medalTable";

// Wikimedia asks API clients to identify themselves.
const USER_AGENT = "SportsWireLive/1.0 (https://sportswirelive.com; hyperianaillc@gmail.com)";

export async function syncEventData(): Promise<void> {
  for (const hub of Object.values(EVENT_HUBS)) {
    if (!hub.medalTable) continue;
    const key = `${hub.eventKey}:medals`;
    const page = hub.medalTable.wikipediaPage;
    const sourceUrl = `https://en.wikipedia.org/wiki/${page}`;
    try {
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&formatversion=2`,
        { headers: { "User-Agent": USER_AGENT } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const table = parseMedalTable((await res.json()).parse?.text ?? "");
      const [prev] = await db.select({ data: eventData.data }).from(eventData).where(eq(eventData.key, key)).limit(1);
      const problem = medalTableProblem(table, (prev?.data as MedalTable | undefined) ?? null);
      if (problem) {
        console.warn(`[events] ${key}: kept last good table — ${problem}`);
        continue;
      }
      await db.insert(eventData)
        .values({ key, eventKey: hub.eventKey, kind: "medals", data: table, sourceUrl, fetchedAt: new Date() })
        .onConflictDoUpdate({ target: eventData.key, set: { data: table, sourceUrl, fetchedAt: new Date() } });
      console.log(`[events] ${key}: ${table.rows.length} nations, ${table.totals?.total ?? "?"} medals`);
    } catch (err) {
      console.error(`[events] ${key} failed:`, err);
    }
  }
}

if (require.main === module) {
  syncEventData().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
