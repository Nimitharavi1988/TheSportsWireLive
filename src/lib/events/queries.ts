import { db } from "@/db";
import { eventData } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { EVENT_HUBS } from "./eventHubs";
import type { MedalTable } from "./medalTable";

export interface StoredMedalTable {
  table: MedalTable;
  sourceUrl: string;
  fetchedAt: string;
}

export async function getMedalTable(eventKey: string): Promise<StoredMedalTable | null> {
  const [row] = await db.select().from(eventData).where(eq(eventData.key, `${eventKey}:medals`)).limit(1);
  return row ? { table: row.data as MedalTable, sourceUrl: row.sourceUrl, fetchedAt: row.fetchedAt.toISOString() } : null;
}

// "China 99 · Japan 29 · South Korea 13 gold" per event with a medal table,
// for the compact "Happening now" tiles.
export async function getMedalLeaderLines(): Promise<Record<string, string>> {
  const keys = Object.values(EVENT_HUBS).filter((h) => h.medalTable).map((h) => `${h.eventKey}:medals`);
  if (keys.length === 0) return {};
  const rows = await db.select().from(eventData).where(inArray(eventData.key, keys));
  const lines: Record<string, string> = {};
  for (const r of rows) {
    const top = (r.data as MedalTable).rows.slice(0, 3);
    if (top.length > 0) lines[r.eventKey] = `${top.map((n) => `${n.nation} ${n.gold}`).join(" · ")} gold`;
  }
  return lines;
}
