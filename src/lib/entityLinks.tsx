/**
 * Turns a tracked player/club's name into an inline link the first time it
 * appears in an article's body text — standard "wiki-style" internal
 * linking (first mention only, same reasoning as any style guide: linking
 * every repeat would be visual noise, not helpful). Complements the
 * title-only player/club Chip row on the article page (article/[slug]/
 * page.tsx's taggedPlayers/taggedClubs) rather than replacing it — a player
 * only mentioned in the body, never the headline, currently has no link
 * anywhere on the page at all; this closes that gap.
 *
 * Reuses TRACKED_PLAYERS/TRACKED_CLUBS' existing searchTerms rather than a
 * separate list — those were already curated to avoid false-positive
 * substring matches (e.g. "Travis Head" not bare "Head", "Declan Rice" not
 * bare "Rice") for the exact same reason this needs, just applied to a
 * title instead of body prose elsewhere in the codebase.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { TRACKED_PLAYERS } from "./players";
import { TRACKED_CLUBS } from "./clubs";

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
  // Longest term first — if two terms could both start matching at the same
  // text position, the more specific (usually longer) one should win.
].sort((a, b) => b.term.length - a.term.length);

const TERM_TO_HREF = new Map(LINKABLE_TERMS.map((t) => [t.term.toLowerCase(), t.href]));

const ENTITY_REGEX = new RegExp(`\\b(${LINKABLE_TERMS.map((t) => escapeRegExp(t.term)).join("|")})\\b`, "gi");

// Distinct from the site's usual "color: inherit" inline-link style
// (attribution captions, source links) — a body-text link needs to read as
// clickable at a glance, same "visual clue" any style guide gives for
// in-content links, so it gets the brand green + underline instead of
// blending into the paragraph.
const LINK_STYLE = { color: "#1d6b3f", textDecoration: "underline", textDecorationColor: "rgba(29,107,63,0.4)" };

// One linker per ARTICLE (not per paragraph) — the returned function shares
// a single `linked` set across every call, so a name already linked in an
// earlier paragraph renders as plain text on a later mention, matching
// "link the first occurrence only."
export function createEntityLinker() {
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
