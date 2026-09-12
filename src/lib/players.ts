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
  // ESPN Cricinfo's numeric player ID (the trailing number in
  // espncricinfo.com/cricketers/{slug}-{id}) — cricket players only. Lets
  // cricinfoPlayerFeeds.ts pull that player's own official RSS feed
  // (real article snippets, direct article URLs) instead of relying solely
  // on the per-player Google News search, whose links can't be resolved to
  // real article text (see articleTextExtractor.ts's Google News finding).
  cricinfoPlayerId?: number;
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
  // Found via nameGapReport.ts (2026-09-12): 4 mentions in 2 weeks.
  { slug: "rodrigo-de-paul", name: "Rodrigo De Paul", searchTerms: ["De Paul"], sport: "football" },
  // Found via nameGapReport.ts (2026-09-12): 3 mentions in 2 weeks.
  { slug: "michael-olise", name: "Michael Olise", searchTerms: ["Olise"], sport: "football" },
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
  { slug: "virat-kohli", name: "Virat Kohli", searchTerms: ["Kohli"], sport: "cricket", cricinfoPlayerId: 253802 },
  { slug: "ben-stokes", name: "Ben Stokes", searchTerms: ["Ben Stokes"], sport: "cricket", cricinfoPlayerId: 311158 },
  { slug: "babar-azam", name: "Babar Azam", searchTerms: ["Babar Azam"], sport: "cricket", cricinfoPlayerId: 348144 },
  { slug: "rohit-sharma", name: "Rohit Sharma", searchTerms: ["Rohit Sharma"], sport: "cricket", cricinfoPlayerId: 34102 },
  { slug: "joe-root", name: "Joe Root", searchTerms: ["Joe Root"], sport: "cricket", cricinfoPlayerId: 303669 },
  { slug: "steve-smith", name: "Steve Smith", searchTerms: ["Steve Smith"], sport: "cricket", cricinfoPlayerId: 267192 },
  { slug: "sunil-narine", name: "Sunil Narine", searchTerms: ["Narine"], sport: "cricket", cricinfoPlayerId: 230558 },
  { slug: "sanju-samson", name: "Sanju Samson", searchTerms: ["Samson"], sport: "cricket", cricinfoPlayerId: 425943 },
  { slug: "jasprit-bumrah", name: "Jasprit Bumrah", searchTerms: ["Bumrah"], sport: "cricket", cricinfoPlayerId: 625383 },
  { slug: "jos-buttler", name: "Jos Buttler", searchTerms: ["Buttler"], sport: "cricket", cricinfoPlayerId: 308967 },
  // "Pant"/"Gill"/"Rahul"/"Warner"/"Head"/"Khan" are common English words or
  // surnames on their own — full name needed, same reasoning as "George
  // Best"/"Shane Warne" above.
  { slug: "rishabh-pant", name: "Rishabh Pant", searchTerms: ["Rishabh Pant"], sport: "cricket", cricinfoPlayerId: 931581 },
  { slug: "shubman-gill", name: "Shubman Gill", searchTerms: ["Shubman Gill"], sport: "cricket", cricinfoPlayerId: 1070173 },
  { slug: "kl-rahul", name: "KL Rahul", searchTerms: ["KL Rahul"], sport: "cricket", cricinfoPlayerId: 422108 },
  { slug: "david-warner", name: "David Warner", searchTerms: ["David Warner"], sport: "cricket", cricinfoPlayerId: 219889 },
  { slug: "travis-head", name: "Travis Head", searchTerms: ["Travis Head"], sport: "cricket", cricinfoPlayerId: 530011 },
  { slug: "rashid-khan", name: "Rashid Khan", searchTerms: ["Rashid Khan"], sport: "cricket", cricinfoPlayerId: 793463 },
  { slug: "kane-williamson", name: "Kane Williamson", searchTerms: ["Kane Williamson"], sport: "cricket", cricinfoPlayerId: 277906 },
  { slug: "pat-cummins", name: "Pat Cummins", searchTerms: ["Pat Cummins"], sport: "cricket", cricinfoPlayerId: 489889 },
  // Found via nameGapReport.ts (2026-09-12): 3 mentions in 2 weeks, all
  // referring to him as just "Boult" — no collision found for that surname
  // alone.
  { slug: "trent-boult", name: "Trent Boult", searchTerms: ["Boult"], sport: "cricket", cricinfoPlayerId: 277912 },
  // "Pandya" alone is ambiguous between Hardik and his brother Krunal, both
  // active internationals — full name needed to pick the right one.
  { slug: "hardik-pandya", name: "Hardik Pandya", searchTerms: ["Hardik Pandya"], sport: "cricket", cricinfoPlayerId: 625371 },
  // "Surya" alone is too common an Indian name-root; "Suryakumar" is
  // distinctive enough on its own.
  { slug: "suryakumar-yadav", name: "Suryakumar Yadav", searchTerms: ["Suryakumar"], sport: "cricket", cricinfoPlayerId: 446507 },
  // Both spellings appear regularly in real headlines — Cricinfo's own
  // slug uses "Sooryavanshi", but plenty of outlets (including gulfnews.com)
  // spell it "Suryavanshi".
  { slug: "vaibhav-sooryavanshi", name: "Vaibhav Sooryavanshi", searchTerms: ["Sooryavanshi", "Suryavanshi"], sport: "cricket", cricinfoPlayerId: 1408688 },
  // Real gap found (2026-09-12): 4 separate articles in one week quoting
  // him on India's XI selection, ex-captain, currently a selector/mentor —
  // recurring source of real headlines with no tracking at all.
  { slug: "ajinkya-rahane", name: "Ajinkya Rahane", searchTerms: ["Rahane"], sport: "cricket", cricinfoPlayerId: 277916 },
  // Real gap (2026-09-12): India's current white-ball captain, already
  // appearing in real headlines ("Shreyas Iyer on tough start to
  // captaincy") with zero tracking — arguably a bigger miss than Rahane.
  { slug: "shreyas-iyer", name: "Shreyas Iyer", searchTerms: ["Shreyas Iyer"], sport: "cricket", cricinfoPlayerId: 642519 },
  // Cricket — legends (previously missing entirely — football had 6
  // legends tracked, cricket had none)
  { slug: "sachin-tendulkar", name: "Sachin Tendulkar", searchTerms: ["Tendulkar"], sport: "cricket", cricinfoPlayerId: 35320 },
  { slug: "ms-dhoni", name: "MS Dhoni", searchTerms: ["Dhoni"], sport: "cricket", cricinfoPlayerId: 28081 },
  { slug: "ricky-ponting", name: "Ricky Ponting", searchTerms: ["Ponting"], sport: "cricket", cricinfoPlayerId: 7133 },
  { slug: "sunil-gavaskar", name: "Sunil Gavaskar", searchTerms: ["Gavaskar"], sport: "cricket", cricinfoPlayerId: 28794 },
  { slug: "muttiah-muralitharan", name: "Muttiah Muralitharan", searchTerms: ["Muralitharan"], sport: "cricket", cricinfoPlayerId: 49636 },
  { slug: "jacques-kallis", name: "Jacques Kallis", searchTerms: ["Kallis"], sport: "cricket", cricinfoPlayerId: 45789 },
  { slug: "ab-de-villiers", name: "AB de Villiers", searchTerms: ["de Villiers"], sport: "cricket", cricinfoPlayerId: 44936 },
  // Found via nameGapReport.ts (2026-09-12): 3 mentions in 2 weeks. Full
  // name used defensively — no confirmed collision for "Akhtar" alone, but
  // no real headline example confirmed it's safe either.
  { slug: "shoaib-akhtar", name: "Shoaib Akhtar", searchTerms: ["Shoaib Akhtar"], sport: "cricket", cricinfoPlayerId: 42655 },
  // "Warne"/"Lara"/"Richards"/"Akram" are common enough English words or
  // surnames on their own that the full name is needed to avoid false
  // matches — same reasoning as "George Best" above.
  { slug: "shane-warne", name: "Shane Warne", searchTerms: ["Shane Warne"], sport: "cricket", cricinfoPlayerId: 8166 },
  { slug: "brian-lara", name: "Brian Lara", searchTerms: ["Brian Lara"], sport: "cricket", cricinfoPlayerId: 52337 },
  { slug: "viv-richards", name: "Viv Richards", searchTerms: ["Viv Richards"], sport: "cricket", cricinfoPlayerId: 52812 },
  { slug: "wasim-akram", name: "Wasim Akram", searchTerms: ["Wasim Akram"], sport: "cricket", cricinfoPlayerId: 43547 },
  { slug: "kapil-dev", name: "Kapil Dev", searchTerms: ["Kapil Dev"], sport: "cricket", cricinfoPlayerId: 30028 },

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
