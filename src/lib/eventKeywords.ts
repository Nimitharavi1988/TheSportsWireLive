// Words that mark a headline as high-interest by EVENT TYPE (transfers,
// records, deaths, milestones) regardless of who the story is about.
// Shared between ingestion-time trending scoring (trending.ts) and the
// homepage's "Transfers & Big News" section selection (page.tsx) so the
// two never drift apart. Living config — add to it as gaps are found in
// the review queue.
export const EVENT_KEYWORDS = [
  "transfer", "sign", "signing", "signs", "deal", "retire", "retirement",
  "retires", "quits", "quit", "move to", "confirmed", "departure", "leave",
  "leaves", "exit", "farewell",
  // Deaths/tributes of sports figures are exactly the kind of major story
  // this list exists to surface — real sports journalism, not gossip.
  "dies", "dead at", "death of", "passes away", "obituary", "tribute",
  "tributes",
  // Records/milestones — another class of story that's always high-interest
  // regardless of which player it's about.
  "record", "milestone", "history", "historic", "breaks", "first player",
  "youngest", "oldest", "hat-trick", "hat trick",
];
