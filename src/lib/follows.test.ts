import { describe, it, expect } from "vitest";
import { parseFollows, serializeFollows, readFollowsFrom, FOLLOWS_COOKIE, MAX_FOLLOWS } from "./follows";
import { FAVORITE_SPORTS_COOKIE } from "./preferences";

describe("parseFollows", () => {
  it("parses kind:slug pairs and round-trips through serializeFollows", () => {
    const refs = parseFollows("club:arsenal,player:virat-kohli,sport:cricket");
    expect(refs).toEqual([
      { kind: "club", slug: "arsenal" },
      { kind: "player", slug: "virat-kohli" },
      { kind: "sport", slug: "cricket" },
    ]);
    expect(serializeFollows(refs)).toBe("club:arsenal,player:virat-kohli,sport:cricket");
  });

  it("accepts a URL-encoded cookie value", () => {
    expect(parseFollows(encodeURIComponent("club:arsenal,sport:cricket"))).toHaveLength(2);
  });

  it("accepts series follows", () => {
    expect(parseFollows("series:asian-games-2026")).toEqual([{ kind: "series", slug: "asian-games-2026" }]);
  });

  it("drops unknown kinds, bad slugs and duplicates", () => {
    expect(parseFollows("team:arsenal,club:Arsenal,club:a b,club:arsenal,club:arsenal,:x,club:")).toEqual([
      { kind: "club", slug: "arsenal" },
    ]);
  });

  it("returns nothing for a malformed escape instead of throwing", () => {
    expect(parseFollows("%E0%A4%A")).toEqual([]);
  });

  it("caps the number of follows", () => {
    const raw = Array.from({ length: MAX_FOLLOWS + 10 }, (_, i) => `club:c${i}`).join(",");
    expect(parseFollows(raw)).toHaveLength(MAX_FOLLOWS);
  });
});

describe("readFollowsFrom", () => {
  it("falls back to the legacy sport favorites cookie", () => {
    const cookies: Record<string, string> = { [FAVORITE_SPORTS_COOKIE]: "cricket,not-a-sport,football" };
    expect(readFollowsFrom((n) => cookies[n])).toEqual([
      { kind: "sport", slug: "cricket" },
      { kind: "sport", slug: "football" },
    ]);
  });

  it("prefers the follows cookie, even when empty (visitor cleared everything)", () => {
    const cookies: Record<string, string> = { [FOLLOWS_COOKIE]: "", [FAVORITE_SPORTS_COOKIE]: "cricket" };
    expect(readFollowsFrom((n) => cookies[n])).toEqual([]);
  });
});
