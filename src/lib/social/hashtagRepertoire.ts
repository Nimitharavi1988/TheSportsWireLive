// Explicit-request tag repertoire (2026-09-22) — deterministic, code-side
// selection rather than letting Gemini invent hashtags. Same reasoning as
// generateSocialCaptions itself: separating "does this tag genuinely apply"
// (a factual question, answered here from real signals — category,
// sourceName, title text) from "write engaging prose" (Gemini's actual job)
// avoids the risk of an LLM confidently attaching an irrelevant tag (e.g.
// #NBA on a cricket story) the way a single combined prompt could.
//
// A tag is only ever added when a REAL signal confirms it — no padding to
// hit a target count. Facebook is capped at 3 (matches the explicit "2-3
// max" rule); Instagram has no artificial floor even though a 10-15 block
// was requested — a genuinely well-tagged article usually yields 5-9 real
// matches here, and padding the rest with irrelevant tags would violate
// this project's own no-invented-facts standard for the sake of a round
// number.

interface SportTags {
  // Always-relevant for this category — no detection needed beyond the
  // category itself (these leagues/sports aren't ambiguous in this
  // pipeline: "basketball" only ever means NBA here, etc.).
  base: string[];
  // [tag, pattern] — only added when the pattern is found in the title.
  conditional: [string, RegExp][];
  // [tag, name-as-it-appears-in-title] — real player match, same
  // case-insensitive substring approach already used by
  // facebook.ts/instagram.ts's own existing hashtag builders.
  players: [string, string][];
}

const GENERAL_TAGS = ["#SportsNews", "#SportsUpdates", "#GameDay", "#MatchDay", "#SportsBlog", "#SportsHighlight", "#SportsMedia"];

const SPORT_TAGS: Partial<Record<string, SportTags>> = {
  football: {
    base: ["#FootballNews", "#SoccerLife"],
    conditional: [
      ["#PremierLeague", /\bPremier League\b/i],
      ["#ChampionsLeague", /\bChampions League\b/i],
      ["#TransferNews", /\btransfer\b/i],
    ],
    players: [
      ["#CristianoRonaldo", "Ronaldo"],
      ["#LionelMessi", "Messi"],
      ["#KylianMbappe", "Mbapp"], // matches Mbappé/Mbappe, same accent-agnostic approach used elsewhere
    ],
  },
  cricket: {
    base: ["#CricketNews", "#CricketFever"],
    conditional: [
      ["#T20Cricket", /\bT20\b/i],
      ["#IPL", /\bIPL\b/i],
    ],
    players: [
      ["#ViratKohli", "Kohli"],
      ["#MSDhoni", "Dhoni"],
      ["#RohitSharma", "Rohit Sharma"],
    ],
  },
  basketball: {
    base: ["#NBA", "#BasketballNews", "#Hoops", "#BallIsLife"],
    conditional: [],
    players: [
      ["#LeBronJames", "LeBron"],
      ["#StephenCurry", "Stephen Curry"],
      ["#CaitlinClark", "Caitlin Clark"],
    ],
  },
  "american-football": {
    base: ["#NFL", "#AmericanFootball", "#Gridiron", "#Touchdown"],
    conditional: [["#FantasyFootball", /\bfantasy\b/i]],
    players: [
      ["#PatrickMahomes", "Mahomes"],
      ["#TravisKelce", "Travis Kelce"],
      ["#JoshAllen", "Josh Allen"],
    ],
  },
  "formula-1": {
    base: ["#F1", "#Formula1", "#Motorsport", "#RaceDay"],
    conditional: [["#GrandPrix", /\bGrand Prix\b/i]],
    players: [
      ["#LewisHamilton", "Hamilton"],
      ["#MaxVerstappen", "Verstappen"],
      ["#CharlesLeclerc", "Leclerc"],
    ],
  },
  volleyball: {
    base: ["#VolleyballNews", "#VolleyballLife", "#SpikeIt"],
    conditional: [],
    players: [
      ["#PaolaEgonu", "Egonu"],
      ["#YujiNishida", "Nishida"],
      ["#GabrielaGuimaraes", "Guimar"], // accent-agnostic, matches Guimarães/Guimaraes
    ],
  },
  athletics: {
    base: ["#TrackAndField", "#AthleticsNews", "#Running"],
    conditional: [],
    players: [
      ["#NoahLyles", "Noah Lyles"],
      ["#MondoDuplantis", "Duplantis"],
      ["#SydneyMcLaughlin", "McLaughlin"],
    ],
  },
};

// Ordered by specificity — a real player match is the most engaging/
// targeted tag available, then confirmed league/event tags, then generic
// sport tags, then a single general tag as filler if nothing else matched.
function selectAllRelevantTags(title: string, category: string): string[] {
  const sport = SPORT_TAGS[category];
  const tags: string[] = [];

  if (sport) {
    for (const [tag, term] of sport.players) {
      if (title.toLowerCase().includes(term.toLowerCase())) tags.push(tag);
    }
    for (const [tag, pattern] of sport.conditional) {
      if (pattern.test(title)) tags.push(tag);
    }
    tags.push(...sport.base);
  }
  tags.push(...GENERAL_TAGS.slice(0, 1));
  return [...new Set(tags)];
}

// Brand tags, always last. Tapping one shows only our own posts — the one
// tag that leads back to us rather than into everyone's topic feed — and it
// always applies, so it fits the "only real signals" rule above. Were in
// every caption until the repertoire rewrite (974403d, 2026-09-22) dropped
// them by accident; restored 2026-09-25. Spellings match 0ea23e7: Facebook
// uses the site name, Instagram matches the @sportswirelivenews handle.
export const FACEBOOK_BRAND_TAG = "#SportsWireLive";
export const INSTAGRAM_BRAND_TAG = "#sportsWireLiveNews";

// 2 topic tags + the brand tag, keeping the 3-tag Facebook cap.
export function selectFacebookHashtags(title: string, category: string): string[] {
  return [...selectAllRelevantTags(title, category).slice(0, 2), FACEBOOK_BRAND_TAG];
}

// No artificial minimum/maximum beyond a sane upper bound — see module
// comment for why padding to hit "10-15" isn't done here. Instagram
// allows 30, so the brand tag is added on top of the topic tags rather
// than replacing one.
export function selectInstagramHashtags(title: string, category: string): string[] {
  return [...selectAllRelevantTags(title, category).slice(0, 15), INSTAGRAM_BRAND_TAG];
}
