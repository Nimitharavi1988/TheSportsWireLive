/**
 * Anonymous per-visitor identity for polls/reactions (fan engagement). The
 * site has no public user accounts — only staff/admin auth (see auth.ts) —
 * so voting is tied to this long-lived cookie instead of a userId. Not
 * signed or sensitive (just an opaque id used for the DB's one-vote/
 * reaction-per-visitor unique constraints), unlike the admin session
 * cookie, which carries a real identity and must be tamper-proof.
 */
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const COOKIE_NAME = "swl_voter_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getOrCreateVoterId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return id;
}
