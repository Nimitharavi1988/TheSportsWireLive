/**
 * Written profiles for player pages (2026-10-08). A profile is short, sourced
 * text about the player; it is shown on the page only after a person has read
 * and approved it. Drafts and approved profiles live in DataSnapshot:
 *   profile:draft:player:<slug>   written by scripts/profileLocal.ts, not shown
 *   profile:player:<slug>         approved (reviewer name recorded), shown
 */
import { db } from "@/db";
import { dataSnapshot } from "@/db/schema";
import { eq } from "drizzle-orm";
import { profileKey, type PlayerProfile } from "./profilesRules";

export * from "./profilesRules";

export async function fetchPlayerProfile(slug: string): Promise<PlayerProfile | null> {
  try {
    const [row] = await db.select({ data: dataSnapshot.data }).from(dataSnapshot).where(eq(dataSnapshot.key, profileKey(slug))).limit(1);
    const d = row?.data as Partial<PlayerProfile> | undefined;
    return d?.text && d.reviewedBy ? (d as PlayerProfile) : null;
  } catch {
    return null;
  }
}
