import { TRACKED_PLAYERS } from "../players";
import { listAthleteNames } from "../events/athleteRead";
import { buildNameIndex, linksForNames, scorecardNames, type NameIndex } from "./playerLinks";
import type { Scorecard } from "./cricketScorecard";

// Tracked cricketers only, built once.
let trackedCricket: NameIndex | null = null;
const trackedIndex = () => (trackedCricket ??= buildNameIndex(TRACKED_PLAYERS.filter((p) => p.sport === "cricket").map((p) => ({ name: p.name, href: `/player/${p.slug}` }))));

// Name as written on the scorecard -> its page, for the names that have one: a
// tracked player's page, else an Asian Games cricketer's athlete page. Server
// only: the player catalog is large.
export async function resolveScorecardLinks(card: Scorecard): Promise<Record<string, string>> {
  const names = scorecardNames(card);
  if (names.length === 0) return {};
  const athletes = buildNameIndex(await listAthleteNames("Cricket").catch(() => []));
  return linksForNames(names, [trackedIndex(), athletes]);
}
