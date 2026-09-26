/**
 * Extra data shown on a multi-sport event's page (/series/[key]) and its
 * "Happening now" tile: a medal table and competition standings. Config,
 * not code — the next Games (Olympics, Commonwealth Games) is a new entry
 * here, keyed by the same event key as eventTagging.ts's EVENTS.
 */
export interface EventHub {
  eventKey: string;
  // English Wikipedia page holding the event's medal table (see
  // medalTable.ts for why, and the checks every snapshot passes).
  medalTable?: { wikipediaPage: string };
  // Group tables from ESPN's cricket standings (league id from ESPN).
  cricketStandings?: { label: string; espnLeagueId: string }[];
}

export const EVENT_HUBS: Record<string, EventHub> = {
  "asian-games-2026": {
    eventKey: "asian-games-2026",
    medalTable: { wikipediaPage: "2026_Asian_Games_medal_table" },
    // Checked live 2026-09-26: group standings with M/W/L/NR/PT/NRR.
    cricketStandings: [{ label: "Men's cricket", espnLeagueId: "22547" }],
  },
};
