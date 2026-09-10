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
  sport: "football" | "cricket"; // used to scope the player page's Standings widget (no standings data exists for cricket on this API tier)
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
];

// Flat list of every search term, for the homepage's auto-highlight check.
export const SUPERSTAR_SEARCH_TERMS = TRACKED_PLAYERS.flatMap((p) => p.searchTerms);
