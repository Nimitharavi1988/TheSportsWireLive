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
}

export const TRACKED_PLAYERS: TrackedPlayer[] = [
  // Football — current
  { slug: "messi", name: "Lionel Messi", searchTerms: ["Messi"] },
  { slug: "ronaldo", name: "Cristiano Ronaldo", searchTerms: ["Ronaldo"] },
  { slug: "mbappe", name: "Kylian Mbappé", searchTerms: ["Mbapp"] },
  { slug: "haaland", name: "Erling Haaland", searchTerms: ["Haaland"] },
  { slug: "neymar", name: "Neymar", searchTerms: ["Neymar"] },
  { slug: "vinicius-junior", name: "Vinícius Júnior", searchTerms: ["Vinicius", "Vinícius"] },
  { slug: "jude-bellingham", name: "Jude Bellingham", searchTerms: ["Bellingham"] },
  { slug: "mohamed-salah", name: "Mohamed Salah", searchTerms: ["Salah"] },
  { slug: "harry-kane", name: "Harry Kane", searchTerms: ["Kane"] },
  { slug: "kevin-de-bruyne", name: "Kevin De Bruyne", searchTerms: ["De Bruyne"] },
  { slug: "luka-modric", name: "Luka Modrić", searchTerms: ["Modric", "Modrić"] },
  // Football — recently retired / legends still regularly in the news
  { slug: "ronaldinho", name: "Ronaldinho", searchTerms: ["Ronaldinho"] },
  { slug: "zinedine-zidane", name: "Zinédine Zidane", searchTerms: ["Zidane"] },
  { slug: "diego-maradona", name: "Diego Maradona", searchTerms: ["Maradona"] },
  { slug: "pele", name: "Pelé", searchTerms: ["Pelé", "Pele"] },
  { slug: "david-beckham", name: "David Beckham", searchTerms: ["Beckham"] },
  { slug: "andres-iniesta", name: "Andrés Iniesta", searchTerms: ["Iniesta"] },
  // Cricket — current
  { slug: "virat-kohli", name: "Virat Kohli", searchTerms: ["Kohli"] },
  { slug: "ben-stokes", name: "Ben Stokes", searchTerms: ["Ben Stokes"] },
  { slug: "babar-azam", name: "Babar Azam", searchTerms: ["Babar Azam"] },
  { slug: "rohit-sharma", name: "Rohit Sharma", searchTerms: ["Rohit Sharma"] },
  { slug: "joe-root", name: "Joe Root", searchTerms: ["Joe Root"] },
  { slug: "steve-smith", name: "Steve Smith", searchTerms: ["Steve Smith"] },
  { slug: "sunil-narine", name: "Sunil Narine", searchTerms: ["Narine"] },
];

// Flat list of every search term, for the homepage's auto-highlight check.
export const SUPERSTAR_SEARCH_TERMS = TRACKED_PLAYERS.flatMap((p) => p.searchTerms);
