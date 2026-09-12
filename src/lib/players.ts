/**
 * Single source of truth for tracked star players — used both to decide
 * which RSS stories get auto-highlighted (page.tsx) and to power each
 * player's dedicated page (/player/[slug]). Keeping one list avoids the
 * two ever drifting apart. Living config — add names as gaps are found.
 */
export interface TrackedPlayer {
  slug: string;
  name: string; // full name, used for the Wikipedia/Wikimedia lookup
  searchTerms: string[]; // substrings matched against article titles (case-insensitive)
  sport: "football" | "cricket" | "american-football"; // used to scope the player page's Standings widget (no standings data exists for cricket or NFL on this API tier) and to tag the player-news search item's category (playerNewsFeeds.ts)
}

export const TRACKED_PLAYERS: TrackedPlayer[] = [
  // Football — current
  { slug: "messi", name: "Lionel Messi", searchTerms: ["Messi"], sport: "football" },
  { slug: "ronaldo", name: "Cristiano Ronaldo", searchTerms: ["Ronaldo"], sport: "football" },
  { slug: "mbappe", name: "Kylian Mbappé", searchTerms: ["Mbapp"], sport: "football" },
  { slug: "haaland", name: "Erling Haaland", searchTerms: ["Haaland"], sport: "football" },
  { slug: "neymar", name: "Neymar", searchTerms: ["Neymar"], sport: "football" },
  { slug: "vinicius-junior", name: "Vinícius Júnior", searchTerms: ["Vinicius", "Vinícius"], sport: "football" },
  { slug: "jude-bellingham", name: "Jude Bellingham", searchTerms: ["Bellingham"], sport: "football" },
  { slug: "mohamed-salah", name: "Mohamed Salah", searchTerms: ["Salah"], sport: "football" },
  { slug: "harry-kane", name: "Harry Kane", searchTerms: ["Kane"], sport: "football" },
  { slug: "kevin-de-bruyne", name: "Kevin De Bruyne", searchTerms: ["De Bruyne"], sport: "football" },
  { slug: "luka-modric", name: "Luka Modrić", searchTerms: ["Modric", "Modrić"], sport: "football" },
  { slug: "bukayo-saka", name: "Bukayo Saka", searchTerms: ["Saka"], sport: "football" },
  { slug: "phil-foden", name: "Phil Foden", searchTerms: ["Foden"], sport: "football" },
  { slug: "jamal-musiala", name: "Jamal Musiala", searchTerms: ["Musiala"], sport: "football" },
  { slug: "pedri", name: "Pedri", searchTerms: ["Pedri"], sport: "football" },
  { slug: "robert-lewandowski", name: "Robert Lewandowski", searchTerms: ["Lewandowski"], sport: "football" },
  // "Martinez" alone is a very common surname (several other tracked
  // players' teams have one) — "Lautaro" (his first name, how he's usually
  // referred to in headlines) is distinctive enough on its own.
  { slug: "lautaro-martinez", name: "Lautaro Martínez", searchTerms: ["Lautaro"], sport: "football" },
  // "Rice" alone is a common word (the food) — full name needed.
  { slug: "declan-rice", name: "Declan Rice", searchTerms: ["Declan Rice"], sport: "football" },
  // "Son" (as in Son Heung-min, near-universally just "Son" in English
  // headlines) is far too common an English word to match safely, and his
  // full name rarely appears in headlines — deliberately left out rather
  // than risking a flood of false positives or a term that would barely
  // ever match. Same reasoning as skipping "Rodri" (collides with the
  // common name "Rodrigo") for this batch.
  // Football — recently retired / legends still regularly in the news
  { slug: "ronaldinho", name: "Ronaldinho", searchTerms: ["Ronaldinho"], sport: "football" },
  { slug: "zinedine-zidane", name: "Zinédine Zidane", searchTerms: ["Zidane"], sport: "football" },
  { slug: "diego-maradona", name: "Diego Maradona", searchTerms: ["Maradona"], sport: "football" },
  { slug: "pele", name: "Pelé", searchTerms: ["Pelé", "Pele"], sport: "football" },
  { slug: "david-beckham", name: "David Beckham", searchTerms: ["Beckham"], sport: "football" },
  { slug: "andres-iniesta", name: "Andrés Iniesta", searchTerms: ["Iniesta"], sport: "football" },
  { slug: "johan-cruyff", name: "Johan Cruyff", searchTerms: ["Cruyff"], sport: "football" },
  { slug: "franz-beckenbauer", name: "Franz Beckenbauer", searchTerms: ["Beckenbauer"], sport: "football" },
  // "Best" alone is far too common a word for a substring match — needs
  // the full name to avoid matching every "best player"/"best goal" story.
  { slug: "george-best", name: "George Best", searchTerms: ["George Best"], sport: "football" },
  { slug: "paolo-maldini", name: "Paolo Maldini", searchTerms: ["Maldini"], sport: "football" },
  { slug: "xavi-hernandez", name: "Xavi Hernández", searchTerms: ["Xavi"], sport: "football" },
  { slug: "roberto-baggio", name: "Roberto Baggio", searchTerms: ["Baggio"], sport: "football" },
  // Cricket — current
  { slug: "virat-kohli", name: "Virat Kohli", searchTerms: ["Kohli"], sport: "cricket" },
  { slug: "ben-stokes", name: "Ben Stokes", searchTerms: ["Ben Stokes"], sport: "cricket" },
  { slug: "babar-azam", name: "Babar Azam", searchTerms: ["Babar Azam"], sport: "cricket" },
  { slug: "rohit-sharma", name: "Rohit Sharma", searchTerms: ["Rohit Sharma"], sport: "cricket" },
  { slug: "joe-root", name: "Joe Root", searchTerms: ["Joe Root"], sport: "cricket" },
  { slug: "steve-smith", name: "Steve Smith", searchTerms: ["Steve Smith"], sport: "cricket" },
  { slug: "sunil-narine", name: "Sunil Narine", searchTerms: ["Narine"], sport: "cricket" },
  { slug: "sanju-samson", name: "Sanju Samson", searchTerms: ["Samson"], sport: "cricket" },
  { slug: "jasprit-bumrah", name: "Jasprit Bumrah", searchTerms: ["Bumrah"], sport: "cricket" },
  { slug: "jos-buttler", name: "Jos Buttler", searchTerms: ["Buttler"], sport: "cricket" },
  // "Pant"/"Gill"/"Rahul"/"Warner"/"Head"/"Khan" are common English words or
  // surnames on their own — full name needed, same reasoning as "George
  // Best"/"Shane Warne" above.
  { slug: "rishabh-pant", name: "Rishabh Pant", searchTerms: ["Rishabh Pant"], sport: "cricket" },
  { slug: "shubman-gill", name: "Shubman Gill", searchTerms: ["Shubman Gill"], sport: "cricket" },
  { slug: "kl-rahul", name: "KL Rahul", searchTerms: ["KL Rahul"], sport: "cricket" },
  { slug: "david-warner", name: "David Warner", searchTerms: ["David Warner"], sport: "cricket" },
  { slug: "travis-head", name: "Travis Head", searchTerms: ["Travis Head"], sport: "cricket" },
  { slug: "rashid-khan", name: "Rashid Khan", searchTerms: ["Rashid Khan"], sport: "cricket" },
  { slug: "kane-williamson", name: "Kane Williamson", searchTerms: ["Kane Williamson"], sport: "cricket" },
  { slug: "pat-cummins", name: "Pat Cummins", searchTerms: ["Pat Cummins"], sport: "cricket" },
  // "Pandya" alone is ambiguous between Hardik and his brother Krunal, both
  // active internationals — full name needed to pick the right one.
  { slug: "hardik-pandya", name: "Hardik Pandya", searchTerms: ["Hardik Pandya"], sport: "cricket" },
  // "Surya" alone is too common an Indian name-root; "Suryakumar" is
  // distinctive enough on its own.
  { slug: "suryakumar-yadav", name: "Suryakumar Yadav", searchTerms: ["Suryakumar"], sport: "cricket" },
  // Cricket — legends (previously missing entirely — football had 6
  // legends tracked, cricket had none)
  { slug: "sachin-tendulkar", name: "Sachin Tendulkar", searchTerms: ["Tendulkar"], sport: "cricket" },
  { slug: "ms-dhoni", name: "MS Dhoni", searchTerms: ["Dhoni"], sport: "cricket" },
  { slug: "ricky-ponting", name: "Ricky Ponting", searchTerms: ["Ponting"], sport: "cricket" },
  { slug: "sunil-gavaskar", name: "Sunil Gavaskar", searchTerms: ["Gavaskar"], sport: "cricket" },
  { slug: "muttiah-muralitharan", name: "Muttiah Muralitharan", searchTerms: ["Muralitharan"], sport: "cricket" },
  { slug: "jacques-kallis", name: "Jacques Kallis", searchTerms: ["Kallis"], sport: "cricket" },
  { slug: "ab-de-villiers", name: "AB de Villiers", searchTerms: ["de Villiers"], sport: "cricket" },
  // "Warne"/"Lara"/"Richards"/"Akram" are common enough English words or
  // surnames on their own that the full name is needed to avoid false
  // matches — same reasoning as "George Best" above.
  { slug: "shane-warne", name: "Shane Warne", searchTerms: ["Shane Warne"], sport: "cricket" },
  { slug: "brian-lara", name: "Brian Lara", searchTerms: ["Brian Lara"], sport: "cricket" },
  { slug: "viv-richards", name: "Viv Richards", searchTerms: ["Viv Richards"], sport: "cricket" },
  { slug: "wasim-akram", name: "Wasim Akram", searchTerms: ["Wasim Akram"], sport: "cricket" },
  { slug: "kapil-dev", name: "Kapil Dev", searchTerms: ["Kapil Dev"], sport: "cricket" },

  // NFL — current stars. Zero NFL players were tracked before this (only
  // football/cricket), which meant the per-player Google News search
  // pipeline that meaningfully expands coverage for those two sports
  // contributed nothing at all to NFL — a real, confirmed gap alongside NFL
  // having just 1 RSS feed vs football's 3 / cricket's 4 (rssFeeds.ts).
  { slug: "patrick-mahomes", name: "Patrick Mahomes", searchTerms: ["Mahomes"], sport: "american-football" },
  // "Allen"/"Jackson"/"Jefferson"/"Hurts"/"Bosa"/"Herbert" are all common
  // enough as surnames (or, for "Hurts", an ordinary English word) that
  // multiple current NFL players or unrelated headlines could match — full
  // name needed, same reasoning as "Declan Rice"/"George Best" above.
  { slug: "josh-allen", name: "Josh Allen", searchTerms: ["Josh Allen"], sport: "american-football" },
  { slug: "lamar-jackson", name: "Lamar Jackson", searchTerms: ["Lamar Jackson"], sport: "american-football" },
  { slug: "justin-jefferson", name: "Justin Jefferson", searchTerms: ["Justin Jefferson"], sport: "american-football" },
  { slug: "jalen-hurts", name: "Jalen Hurts", searchTerms: ["Jalen Hurts"], sport: "american-football" },
  { slug: "nick-bosa", name: "Nick Bosa", searchTerms: ["Nick Bosa"], sport: "american-football" },
  { slug: "justin-herbert", name: "Justin Herbert", searchTerms: ["Justin Herbert"], sport: "american-football" },
  { slug: "christian-mccaffrey", name: "Christian McCaffrey", searchTerms: ["McCaffrey"], sport: "american-football" },
  // "Burrow" alone is a common English word (an animal's burrow) — full
  // name needed, same reasoning as "Jalen Hurts" above.
  { slug: "joe-burrow", name: "Joe Burrow", searchTerms: ["Joe Burrow"], sport: "american-football" },
  { slug: "micah-parsons", name: "Micah Parsons", searchTerms: ["Micah Parsons"], sport: "american-football" },
  { slug: "travis-kelce", name: "Travis Kelce", searchTerms: ["Travis Kelce"], sport: "american-football" },
  { slug: "tyreek-hill", name: "Tyreek Hill", searchTerms: ["Tyreek Hill"], sport: "american-football" },
  { slug: "ceedee-lamb", name: "CeeDee Lamb", searchTerms: ["CeeDee Lamb"], sport: "american-football" },
  { slug: "aaron-rodgers", name: "Aaron Rodgers", searchTerms: ["Aaron Rodgers"], sport: "american-football" },
  // Legends.
  { slug: "tom-brady", name: "Tom Brady", searchTerms: ["Tom Brady"], sport: "american-football" },
  { slug: "peyton-manning", name: "Peyton Manning", searchTerms: ["Peyton Manning"], sport: "american-football" },
];

// Flat list of every search term, for the homepage's auto-highlight check.
export const SUPERSTAR_SEARCH_TERMS = TRACKED_PLAYERS.flatMap((p) => p.searchTerms);
