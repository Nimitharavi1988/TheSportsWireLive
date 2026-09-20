import { describe, it, expect } from "vitest";
import { createEntityLinker } from "./entityLinks";
import type { ReactNode } from "react";
import type { ReactElement } from "react";

function isLinkElement(node: ReactNode): node is ReactElement<{ href: string; children: ReactNode }> {
  return typeof node === "object" && node !== null && "props" in node && "href" in (node as any).props;
}

describe("createEntityLinker", () => {
  it("links a tracked player's name to their page", () => {
    const linkify = createEntityLinker();
    const nodes = linkify("Kohli scored a century today.");
    const linkNode = nodes.find(isLinkElement);
    expect(linkNode).toBeDefined();
    expect(linkNode!.props.href).toBe("/player/virat-kohli");
    expect(linkNode!.props.children).toBe("Kohli");
  });

  it("preserves the surrounding plain text", () => {
    const linkify = createEntityLinker();
    const nodes = linkify("Kohli scored a century today.");
    // No leading empty-string node when the match starts at position 0.
    expect(isLinkElement(nodes[0])).toBe(true);
    expect(nodes[nodes.length - 1]).toBe(" scored a century today.");
  });

  it("only links the FIRST mention across multiple calls (paragraphs)", () => {
    const linkify = createEntityLinker();
    const first = linkify("Kohli walked out to bat.");
    const second = linkify("Kohli then reached fifty.");

    expect(first.some(isLinkElement)).toBe(true);
    expect(second.some(isLinkElement)).toBe(false);
    expect(second.join("")).toBe("Kohli then reached fifty.");
  });

  it("links a tracked club's name to its page", () => {
    const linkify = createEntityLinker();
    const nodes = linkify("Manchester City announced a new signing.");
    const linkNode = nodes.find(isLinkElement);
    expect(linkNode).toBeDefined();
    expect(linkNode!.props.href).toContain("/club/");
  });

  it("links two different entities independently in the same call", () => {
    const linkify = createEntityLinker();
    const nodes = linkify("Kohli and Rohit Sharma opened the innings.");
    const links = nodes.filter(isLinkElement);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.props.href).sort()).toEqual(["/player/rohit-sharma", "/player/virat-kohli"]);
  });

  it("does not link plain text with no tracked entity in it", () => {
    const linkify = createEntityLinker();
    const nodes = linkify("The weather was sunny in the stadium.");
    expect(nodes.some(isLinkElement)).toBe(false);
    expect(nodes.join("")).toBe("The weather was sunny in the stadium.");
  });

  it("is case-insensitive but preserves the original casing in the link text", () => {
    const linkify = createEntityLinker();
    const nodes = linkify("KOHLI is in fine form.");
    const linkNode = nodes.find(isLinkElement);
    expect(linkNode!.props.children).toBe("KOHLI");
  });

  // Site-wide entity expansion (2026-09-20): countries and the roster
  // "search-link" player tier, added alongside the existing player/club
  // tiers above.
  it("links a tracked country's name to its page", () => {
    const linkify = createEntityLinker();
    const nodes = linkify("India won the toss and elected to bat.");
    const linkNode = nodes.find(isLinkElement);
    expect(linkNode).toBeDefined();
    expect(linkNode!.props.href).toBe("/country/india");
  });

  it("links a real roster player (not a curated star) to an on-site search instead of a profile page", () => {
    const linkify = createEntityLinker();
    // A real current NFL roster name confirmed present in ROSTER_PLAYERS
    // (generateRosterPlayers.ts, 2026-09-20) but never added to
    // TRACKED_PLAYERS -- exactly the "highlight everyone, but scale via
    // search instead of a full profile" case this tier exists for.
    const nodes = linkify("J.J. McCarthy waits in the wings for his chance.");
    const linkNode = nodes.find(isLinkElement);
    expect(linkNode).toBeDefined();
    expect(linkNode!.props.href).toBe(`/search?q=${encodeURIComponent("J.J. McCarthy")}`);
  });

  it("links a curated star to their real profile page, not a search link, even though they're also a real roster player", () => {
    const linkify = createEntityLinker();
    // Kyler Murray is both a TRACKED_PLAYERS star AND a real current NFL
    // roster player -- the generator excludes anyone already tracked when
    // building ROSTER_PLAYERS, so this confirms that exclusion actually
    // worked, not just that the linker would prefer one tier over another.
    const nodes = linkify("Kyler Murray suffered a concussion in Week 1.");
    const linkNode = nodes.find(isLinkElement);
    expect(linkNode).toBeDefined();
    expect(linkNode!.props.href).toBe("/player/kyler-murray");
  });
});
