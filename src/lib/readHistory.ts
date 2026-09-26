// Stories this reader has opened in the current browser session, newest
// last — used to keep "Up next" moving forward instead of offering a story
// they just came from. sessionStorage only (resets with the tab session),
// capped, and every access guarded: storage can be missing or throw
// (private mode, blocked site data), in which case nothing is remembered.
const KEY = "swl:read";
const MAX = 50;

export function readSlugs(): string[] {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function markRead(slug: string): void {
  try {
    const next = [...readSlugs().filter((s) => s !== slug), slug].slice(-MAX);
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — fine, Up next just won't skip read stories.
  }
}

// The first candidate not yet read this session; the first overall when
// every candidate has been read (pure, unit-tested).
export function pickUnread<T extends { slug: string }>(candidates: T[], read: string[]): T | null {
  const readSet = new Set(read);
  return candidates.find((c) => !readSet.has(c.slug)) ?? candidates[0] ?? null;
}
