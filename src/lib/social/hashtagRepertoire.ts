import { TRACKED_PLAYERS } from "../players";
import { entitiesInTitle } from "./entityHandles";
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
  "college-football": {
    base: ["#CollegeFootball", "#CFB", "#NCAAF", "#Gridiron"],
    conditional: [["#HeismanTrophy", /\bHeisman\b/i], ["#CFBPlayoff", /\bplayoff\b/i]],
    players: [],
  },
  wnba: {
    base: ["#WNBA", "#WNBAPlayoffs", "#Hoops"],
    conditional: [],
    players: [
      ["#CaitlinClark", "Caitlin Clark"],
      ["#AjaWilson", "Wilson"],
      ["#BreannaStewart", "Breanna Stewart"],
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
function selectAllRelevantTags(title: string, category: string, withEntities = true): string[] {
  const sport = SPORT_TAGS[category];
  const tags: string[] = [];

  // The tracked players and clubs the headline leads with, from the full
  // lists (entityHandles.ts), ahead of the short hand-written lists below.
  // Instagram only: Facebook link posts keep their original tags.
  if (withEntities) for (const e of entitiesInTitle(title, category, { precise: false }).slice(0, 3)) tags.push(personHashtag(e.name));

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
  return [...selectAllRelevantTags(title, category, false).slice(0, 2), FACEBOOK_BRAND_TAG];
}

// No artificial minimum/maximum beyond a sane upper bound — see module
// comment for why padding to hit "10-15" isn't done here. Instagram
// allows 30, so the brand tag is added on top of the topic tags rather
// than replacing one.
export function selectInstagramHashtags(title: string, category: string, limit = 15): string[] {
  return [...selectAllRelevantTags(title, category).slice(0, limit), INSTAGRAM_BRAND_TAG];
}

// ---- India cricket Page (facebookDestinations.ts INDIA_CRICKET_PAGE) -----
// A cricket-only audience wants the match and the people, not generic
// "#CricketNews": the fixture tag fans follow (#INDvWI), the player the
// story is about (from the tracked list, players.ts), and #TeamIndia.
// Still 3 at most, like every Facebook post here.

// Cricket nations as fixture tags use them (#INDvWI, #INDvAUS).
const CRICKET_CODES: [string, RegExp][] = [
  ["IND", /\b(india|ind)\b(?!\s+(a|u19|under-19s?|women)\b)/i],
  ["WI", /\b(west indies|windies|wi)\b/i],
  ["AUS", /\b(australia|aus)\b/i],
  ["ENG", /\b(england|eng)\b/i],
  ["PAK", /\b(pakistan|pak)\b/i],
  ["SA", /\b(south africa|sa)\b/i],
  ["NZ", /\b(new zealand|nz)\b/i],
  ["SL", /\b(sri lanka|sl)\b/i],
  ["BAN", /\b(bangladesh|ban)\b/i],
  ["AFG", /\b(afghanistan|afg)\b/i],
  ["ZIM", /\b(zimbabwe|zim)\b/i],
  ["IRE", /\b(ireland|ire)\b/i],
];

// "#INDvWI" when the headline names India and one opponent (India first,
// the way fans write it); null otherwise (pure, unit-tested).
export function cricketFixtureTag(title: string): string | null {
  const found = CRICKET_CODES.filter(([, re]) => re.test(title)).map(([code]) => code);
  if (!found.includes("IND")) return null;
  const opponents = found.filter((c) => c !== "IND");
  return opponents.length === 1 ? `#INDv${opponents[0]}` : null;
}

// "#ViratKohli" from a name: letters and digits only, accents dropped.
export function personHashtag(name: string): string {
  return "#" + name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "");
}

export function selectIndiaCricketHashtags(title: string): string[] {
  const tags: string[] = [];
  const fixture = cricketFixtureTag(title);
  if (fixture) tags.push(fixture);
  const lower = title.toLowerCase();
  // The player the headline leads with (earliest mention), not whoever
  // comes first in the tracked list.
  let player: { name: string; at: number } | null = null;
  for (const p of TRACKED_PLAYERS) {
    if (p.sport !== "cricket") continue;
    for (const t of p.searchTerms) {
      const at = lower.indexOf(t.toLowerCase());
      if (at >= 0 && (!player || at < player.at)) player = { name: p.name, at };
    }
  }
  if (player) tags.push(personHashtag(player.name));
  if (/\b(india|team india|ind)\b/i.test(title)) tags.push("#TeamIndia");
  for (const filler of ["#TeamIndia", "#CricketNews", "#Cricket"]) {
    if (tags.length >= 3) break;
    if (!tags.includes(filler)) tags.push(filler);
  }
  return tags.slice(0, 3);
}
