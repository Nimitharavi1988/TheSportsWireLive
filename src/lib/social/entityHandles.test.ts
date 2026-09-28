import { describe, expect, it } from "vitest";
import { entitiesInTitle } from "./entityHandles";
import { reelTagsFor } from "./reelTags";

describe("entitiesInTitle", () => {
  it("does not @-tag Harry Kane for a bare 'Kane' or a cricketer named Kane", () => {
    expect(reelTagsFor("Kane Williamson hits century as New Zealand beat Sri Lanka", "cricket").userTags).toEqual([]);
    expect(reelTagsFor("Kane scores again in a routine win", "football").userTags).toEqual([]);
    expect(reelTagsFor("Harry Kane scores again in a routine win", "football").userTags).toEqual([{ username: "harrykane" }]);
  });

  it("still allows a bare 'Kane' for hashtags (football only)", () => {
    expect(entitiesInTitle("Kane scores again", "football", { precise: false }).map((e) => e.slug)).toContain("harry-kane");
    expect(entitiesInTitle("Kane scores again", "cricket", { precise: false }).map((e) => e.slug)).not.toContain("harry-kane");
  });

  it("orders by first mention and caps tags at 3", () => {
    const tags = reelTagsFor("Haaland and Arsenal and Chelsea and Liverpool clash", "football").userTags;
    expect(tags).toEqual([{ username: "erling" }, { username: "arsenal" }, { username: "chelseafc" }]);
  });

  it("tags a league when no player or club is named", () => {
    expect(reelTagsFor("NFL owners approve new rule", "american-football").userTags).toEqual([{ username: "nfl" }]);
  });
});
