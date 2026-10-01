/**
 * Which names on a cricket scorecard have a page on the site (pure,
 * unit-tested): a tracked player's page (/player/…) first, else an Asian
 * Games athlete's page (/athlete/…). A name is linked only on an exact match
 * of the full name — "Abhishek Sharma" to Abhishek Sharma — and never when two
 * pages claim it, so a link is never a guess.
 */
import type { Scorecard } from "./cricketScorecard";

// Accents, case and punctuation don't matter: "Jos Buttler" = "jos buttler".
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type NameIndex = Map<string, string | null>;

// Name -> page. A name two different pages share maps to null (ambiguous).
export function buildNameIndex(entries: { name: string; href: string }[]): NameIndex {
  const index: NameIndex = new Map();
  for (const { name, href } of entries) {
    const key = normalizeName(name);
    if (!key) continue;
    const existing = index.get(key);
    index.set(key, existing === undefined || existing === href ? href : null);
  }
  return index;
}

// Every name on the scorecard once: batters, bowlers, those yet to bat.
export function scorecardNames(card: Scorecard): string[] {
  const names = new Set<string>();
  for (const i of card.innings) {
    for (const b of i.batting) names.add(b.name);
    for (const b of i.bowling) names.add(b.name);
    for (const n of i.didNotBat) names.add(n);
  }
  for (const y of card.yetToBat) for (const p of y.players) names.add(p);
  names.delete("");
  return [...names];
}

// Name as written -> page, for the names that have one. `indexes` in order of
// preference (a player page before an athlete page).
export function linksForNames(names: string[], indexes: NameIndex[]): Record<string, string> {
  const links: Record<string, string> = {};
  for (const name of names) {
    const key = normalizeName(name);
    for (const index of indexes) {
      const hit = index.get(key);
      // Ambiguous in a preferred index: don't fall through to a less certain one.
      if (hit === null) break;
      if (hit) {
        links[name] = hit;
        break;
      }
    }
  }
  return links;
}
