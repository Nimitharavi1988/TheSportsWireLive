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
});
