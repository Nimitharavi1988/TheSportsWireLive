import { describe, it, expect } from "vitest";
import { searchEntities, resolveFollows, followMatchers, buildPrefixTsQuery, popularEntities } from "./entitySearch";

describe("searchEntities", () => {
  it("ranks a name-prefix match first", () => {
    const [first] = searchEntities("ars");
    expect(first).toMatchObject({ kind: "club", slug: "arsenal", href: "/club/arsenal" });
  });

  it("matches a later word of the name and a player's search term", () => {
    expect(searchEntities("kohli").map((e) => e.slug)).toContain("virat-kohli");
    expect(searchEntities("madrid").map((e) => e.slug)).toContain("real-madrid");
  });

  it("ignores accents", () => {
    expect(searchEntities("mbappe").map((e) => e.slug)).toContain("mbappe");
  });

  it("does not match mid-word substrings", () => {
    expect(searchEntities("senal").map((e) => e.slug)).not.toContain("arsenal");
  });

  it("finds sports by label", () => {
    expect(searchEntities("cricket")[0]).toMatchObject({ kind: "sport", slug: "cricket" });
  });

  it("needs at least two characters", () => {
    expect(searchEntities("a")).toEqual([]);
  });
});

describe("resolveFollows / followMatchers", () => {
  it("drops follows that aren't in the tracked catalogs", () => {
    const resolved = resolveFollows([
      { kind: "club", slug: "arsenal" },
      { kind: "club", slug: "not-a-real-club" },
      { kind: "sport", slug: "cricket" },
    ]);
    expect(resolved.map((e) => e.name)).toEqual(["Arsenal", "Cricket"]);
  });

  it("splits follows into title terms and sport categories", () => {
    const m = followMatchers([
      { kind: "club", slug: "arsenal" },
      { kind: "sport", slug: "cricket" },
    ]);
    expect(m.titleTerms).toEqual([{ key: "club:arsenal", name: "Arsenal", terms: ["Arsenal"] }]);
    expect(m.categories).toEqual([{ key: "sport:cricket", name: "Cricket", category: "cricket" }]);
  });

  it("every popular entity resolves", () => {
    expect(popularEntities().length).toBeGreaterThanOrEqual(6);
  });
});

describe("buildPrefixTsQuery", () => {
  it("splits finished words from the word being typed", () => {
    expect(buildPrefixTsQuery("Real Mad")).toEqual({ complete: "real", partial: "mad" });
    expect(buildPrefixTsQuery("ars")).toEqual({ complete: null, partial: "ars" });
  });

  it("strips tsquery operators from user input", () => {
    expect(buildPrefixTsQuery("a & b | !c:*")).toEqual({ complete: "a & b", partial: "c" });
    expect(buildPrefixTsQuery("  !!  ")).toBeNull();
  });
});

describe("searchEntities with extra items", () => {
  const series = {
    entity: { kind: "series" as const, slug: "india-vs-west-indies-odi", name: "India vs West Indies • ODI", subtitle: "ODI series", href: "/series/india-vs-west-indies-odi", initials: "IW", color: "#b8752e" },
    haystack: ["india vs west indies  odi", "india vs west indies odi"],
  };

  it("matches a multi-word query starting mid-name", () => {
    expect(searchEntities("west indies", 6, [series]).map((e) => e.slug)).toContain("india-vs-west-indies-odi");
  });

  it("still never matches mid-word", () => {
    expect(searchEntities("ndies", 6, [series]).map((e) => e.slug)).not.toContain("india-vs-west-indies-odi");
  });
});
