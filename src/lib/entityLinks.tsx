/**
 * Turns a tracked player/club/country's name into an inline link the first
 * time it appears in an article's body text — standard "wiki-style" internal
 * linking (first mention only, same reasoning as any style guide: linking
 * every repeat would be visual noise, not helpful). Complements the
 * title-only player/club Chip row on the article page (article/[slug]/
 * page.tsx's taggedPlayers/taggedClubs) rather than replacing it — a player
 * only mentioned in the body, never the headline, currently has no link
 * anywhere on the page at all; this closes that gap.
 *
 * Reuses TRACKED_PLAYERS/TRACKED_CLUBS/TRACKED_COUNTRIES' existing
 * searchTerms rather than a separate list — those were already curated to
 * avoid false-positive substring matches (e.g. "Travis Head" not bare
 * "Head", "Declan Rice" not bare "Rice") for the exact same reason this
 * needs, just applied to a title instead of body prose elsewhere in the
 * codebase.
 *
 * Two tiers, two href shapes (2026-09-20, explicit site-wide expansion):
 * curated stars/clubs/countries link to their real dedicated page; every
 * other real roster player (ROSTER_PLAYERS — see that file's own header for
 * why a full profile page isn't built for these) links to an on-site search
 * instead. ROSTER_PLAYERS is generated with anyone already in
 * TRACKED_PLAYERS excluded, so the same name should never appear in both
 * tiers — but `isSearchLink` on LinkableTerm still lets the styling/href
 * logic branch correctly either way, rather than relying on generation-time
 * exclusion alone.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { TRACKED_PLAYERS } from "./players";
import { TRACKED_CLUBS } from "./clubs";
import { TRACKED_COUNTRIES } from "./countries";
import { ROSTER_PLAYERS } from "./rosterPlayers";
import { SCOPED_ROSTER } from "./rosterPlayersScoped";

interface LinkableTerm {
  term: string;
  href: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LINKABLE_TERMS: LinkableTerm[] = [
  ...TRACKED_PLAYERS.flatMap((p) => p.searchTerms.map((term) => ({ term, href: `/player/${p.slug}` }))),
  ...TRACKED_CLUBS.flatMap((c) => c.searchTerms.map((term) => ({ term, href: `/club/${c.slug}` }))),
  ...TRACKED_COUNTRIES.flatMap((c) => c.searchTerms.map((term) => ({ term, href: `/country/${c.slug}` }))),
  ...ROSTER_PLAYERS.flatMap((p) => p.searchTerms.map((term) => ({ term, href: `/search?q=${encodeURIComponent(p.name)}` }))),
  // Longest term first — if two terms could both start matching at the same
  // text position, the more specific (usually longer) one should win.
].sort((a, b) => b.term.length - a.term.length);

// One matcher per sport. The shared terms above link in every article; each
// sport also has names that link only in its own articles (SCOPED_ROSTER —
// college football rosters, cricket squads, ...). Scoping keeps a common name
// from linking in an unrelated story, and means an article scans only its own
// sport's names rather than all of them: measured 0.8ms per article with the
// shared terms, about 3.6ms if every sport's names were in one pattern.
interface Matcher {
  regex: RegExp;
  hrefOf: Map<string, string>;
}

function buildMatcher(terms: LinkableTerm[]): Matcher {
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);
  return {
    regex: new RegExp(`\\b(${sorted.map((t) => escapeRegExp(t.term)).join("|")})\\b`, "gi"),
    hrefOf: new Map(sorted.map((t) => [t.term.toLowerCase(), t.href])),
  };
}

const SHARED_MATCHER = buildMatcher(LINKABLE_TERMS);
const sportMatchers = new Map<string, Matcher>();

// The matcher for an article of this sport (its top-level category,
// "cricket", "college-football"); the shared one when the sport has no names of
// its own. Built on first use, then kept.
function matcherFor(sport?: string): Matcher {
  const names = sport ? SCOPED_ROSTER[sport] : undefined;
  if (!sport || !names || names.length === 0) return SHARED_MATCHER;
  let matcher = sportMatchers.get(sport);
  if (!matcher) {
    // Scoped terms first, so on a tie the shared (tracked) term wins.
    matcher = buildMatcher([...names.map((n) => ({ term: n, href: `/search?q=${encodeURIComponent(n)}` })), ...LINKABLE_TERMS]);
    sportMatchers.set(sport, matcher);
  }
  return matcher;
}

// Distinct from the site's usual "color: inherit" inline-link style
// (attribution captions, source links) — a body-text link needs to read as
// clickable at a glance. Color + medium weight rather than an underline —
// the underline read as dated; brand-green + weight is the same "visual
// clue" a reader needs, in the flat, no-underline style most modern
// editorial sites (and this site's own chips/nav) already use.
const LINK_STYLE = { color: "#1d6b3f", fontWeight: 600, textDecoration: "none" };

// One linker per ARTICLE (not per paragraph) — the returned function shares
// a single `linked` set across every call, so a name already linked in an
// earlier paragraph renders as plain text on a later mention, matching
// "link the first occurrence only."
export function createEntityLinker(sport?: string) {
  const { regex: ENTITY_REGEX, hrefOf: TERM_TO_HREF } = matcherFor(sport);
  const linked = new Set<string>();
  let key = 0;

  return function linkifyEntities(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    ENTITY_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = ENTITY_REGEX.exec(text))) {
      const matchedTerm = match[0];
      const href = TERM_TO_HREF.get(matchedTerm.toLowerCase());
      if (!href) continue;

      if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

      if (linked.has(href)) {
        nodes.push(matchedTerm);
      } else {
        linked.add(href);
        nodes.push(
          <Link key={`entity-link-${key++}`} href={href} style={LINK_STYLE}>
            {matchedTerm}
          </Link>
        );
      }

      lastIndex = match.index + matchedTerm.length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
  };
}
