import { describe, it, expect } from "vitest";
import { orderForVariety } from "./reelVariety";

const c = (id: string, category: string, sourceName = "Yahoo Sports") => ({ id, category, sourceName });
const isMatch = (s: string) => s === "ESPN Cricket";

describe("orderForVariety", () => {
  it("keeps trending order when nothing needs demoting", () => {
    expect(orderForVariety([c("a", "cricket"), c("b", "hockey")], [], isMatch).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("moves a sport that already made 3 of the last reels to the back", () => {
    const recent = ["hockey", "hockey", "hockey", "cricket", "football", "hockey"];
    expect(orderForVariety([c("h", "hockey"), c("n", "american-football"), c("k", "cricket")], recent, isMatch).map((x) => x.id)).toEqual(["n", "k", "h"]);
  });

  it("demotes match-result rows, most of all when the sport is also over-used", () => {
    const list = [c("m", "cricket", "ESPN Cricket"), c("n", "american-football")];
    expect(orderForVariety(list, [], isMatch).map((x) => x.id)).toEqual(["n", "m"]);
    expect(orderForVariety([c("m", "cricket", "ESPN Cricket"), c("k", "cricket"), c("n", "american-football")], ["cricket", "cricket", "cricket"], isMatch).map((x) => x.id)).toEqual(["n", "k", "m"]);
  });

  it("counts sub-categories as their sport", () => {
    expect(orderForVariety([c("f", "football/world-cup"), c("n", "american-football")], ["football", "football", "football"], isMatch).map((x) => x.id)).toEqual(["n", "f"]);
  });
});
