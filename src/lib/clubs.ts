/**
 * Tracked clubs for /club/[slug] pages — same pattern as players.ts (a
 * curated list + substring search terms matched against article titles),
 * not a new mechanism. Search terms are the club's core distinctive name
 * without a league-specific suffix (e.g. "Manchester City" not "Manchester
 * City FC") since these match as substrings — safer than needing to know
 * every league's exact naming convention (FC/CF/AFC prefixes vary).
 *
 * Deliberately not exhaustive — covers 3-5 of the best-known clubs per
 * league already in STANDINGS_LEAGUES, not all ~180 teams. Living config,
 * extend as gaps are found the same way players.ts does.
 */
export interface TrackedClub {
  slug: string;
  name: string;
  searchTerms: string[];
}

export const TRACKED_CLUBS: TrackedClub[] = [
  // Premier League
  { slug: "manchester-city", name: "Manchester City", searchTerms: ["Manchester City"] },
  { slug: "arsenal", name: "Arsenal", searchTerms: ["Arsenal"] },
  { slug: "liverpool", name: "Liverpool", searchTerms: ["Liverpool"] },
  { slug: "manchester-united", name: "Manchester United", searchTerms: ["Manchester United"] },
  { slug: "chelsea", name: "Chelsea", searchTerms: ["Chelsea"] },
  // La Liga
  { slug: "real-madrid", name: "Real Madrid", searchTerms: ["Real Madrid"] },
  { slug: "barcelona", name: "Barcelona", searchTerms: ["Barcelona"] },
  { slug: "atletico-madrid", name: "Atlético Madrid", searchTerms: ["Atlético Madrid", "Atletico Madrid"] },
  // Serie A
  { slug: "inter-milan", name: "Inter Milan", searchTerms: ["Internazionale", "Inter Milan"] },
  { slug: "ac-milan", name: "AC Milan", searchTerms: ["AC Milan"] },
  { slug: "juventus", name: "Juventus", searchTerms: ["Juventus"] },
  // Bundesliga
  { slug: "bayern-munich", name: "Bayern Munich", searchTerms: ["Bayern Munich", "Bayern München"] },
  { slug: "borussia-dortmund", name: "Borussia Dortmund", searchTerms: ["Borussia Dortmund"] },
  // Ligue 1
  { slug: "psg", name: "Paris Saint-Germain", searchTerms: ["Paris Saint-Germain", "PSG"] },
  { slug: "marseille", name: "Marseille", searchTerms: ["Marseille"] },
  // Primeira Liga
  { slug: "benfica", name: "Benfica", searchTerms: ["Benfica"] },
  { slug: "porto", name: "FC Porto", searchTerms: ["FC Porto", "Porto"] },
  { slug: "sporting-cp", name: "Sporting CP", searchTerms: ["Sporting Clube de Portugal", "Sporting CP"] },
  // Eredivisie
  { slug: "ajax", name: "Ajax", searchTerms: ["Ajax"] },
  { slug: "psv", name: "PSV Eindhoven", searchTerms: ["PSV"] },
  // Brasileirão
  { slug: "flamengo", name: "Flamengo", searchTerms: ["Flamengo"] },
  { slug: "palmeiras", name: "Palmeiras", searchTerms: ["Palmeiras"] },
];
