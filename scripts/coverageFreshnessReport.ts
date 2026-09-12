/**
 * Reusable maintenance tool (NOT a one-off — keep this), answering "which
 * currently-tracked key players have gone quiet?" — the flip side of
 * nameGapReport.ts (which finds names that should be tracked but aren't).
 * This one checks names that ARE tracked but haven't had a single article
 * — of any status, not just published — in the lookback window, which
 * usually means either a real news lull for that player, or a search-term/
 * ID problem worth checking (e.g. a misspelled searchTerm, a wrong
 * Cricinfo ID quietly failing every fetch).
 *
 * Deliberately reports "no article at all" rather than "no PUBLISHED
 * article" — a player with several pending_review items isn't a coverage
 * gap, that's a review-queue backlog, a different problem this isn't
 * trying to surface.
 *
 * Run periodically: npx tsx --env-file=.env scripts/coverageFreshnessReport.ts
 */
import { db } from "../src/lib/db";
import { TRACKED_PLAYERS } from "../src/lib/players";

const LOOKBACK_HOURS = 24;

// Legends/retired players are excluded — "no news today" is the expected,
// permanent state for Sachin Tendulkar or Diego Maradona, not a gap.
// Judged by cricinfoPlayerId's absence being unreliable (current NFL/
// football players don't have one at all), so this is a small hand-curated
// exclusion list instead — the same "living config" pattern as
// players.ts's own comments throughout.
const RETIRED_OR_LEGEND_SLUGS = new Set([
  "ronaldinho", "zinedine-zidane", "diego-maradona", "pele", "david-beckham",
  "andres-iniesta", "johan-cruyff", "franz-beckenbauer", "george-best",
  "paolo-maldini", "xavi-hernandez", "roberto-baggio",
  "sachin-tendulkar", "ms-dhoni", "ricky-ponting", "sunil-gavaskar",
  "muttiah-muralitharan", "jacques-kallis", "ab-de-villiers", "shane-warne",
  "brian-lara", "viv-richards", "wasim-akram", "kapil-dev", "shoaib-akhtar",
  "tom-brady", "peyton-manning",
]);

async function main() {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const currentPlayers = TRACKED_PLAYERS.filter((p) => !RETIRED_OR_LEGEND_SLUGS.has(p.slug));

  const quiet: { name: string; slug: string }[] = [];

  for (const player of currentPlayers) {
    const count = await db.article.count({
      where: {
        createdAt: { gt: since },
        OR: player.searchTerms.map((term) => ({ title: { contains: term, mode: "insensitive" as const } })),
      },
    });
    if (count === 0) quiet.push({ name: player.name, slug: player.slug });
  }

  console.log(`Checked ${currentPlayers.length} current (non-legend) tracked players over the last ${LOOKBACK_HOURS}h.\n`);

  if (quiet.length === 0) {
    console.log("Every tracked current player has at least one article — no gaps.");
    return;
  }

  console.log(`${quiet.length} player(s) with ZERO articles (any status) in the last ${LOOKBACK_HOURS}h:\n`);
  for (const p of quiet) console.log(`  - ${p.name} (${p.slug})`);
  console.log(
    "\nThis can mean a real news lull, OR a broken searchTerm/Cricinfo ID for that player — worth a quick manual" +
    " Google News check on anyone surprising in this list before assuming it's just a quiet day."
  );
}

main().then(() => process.exit(0));
