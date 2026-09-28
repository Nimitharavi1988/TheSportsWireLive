import { describe, it, expect } from "vitest";
import { pickHeroArticles } from "./heroConfig";

const a = (id: string, category: string) => ({ id, category });

describe("pickHeroArticles", () => {
  const pool = [
    a("c1", "cricket"), a("at1", "athletics"), a("c2", "cricket"), a("c3", "cricket"),
    a("b1", "baseball"), a("n1", "american-football"), a("n2", "american-football"),
  ];

  it("caps one sport at 2 slides on the all-sports page, keeping score order", () => {
    expect(pickHeroArticles(pool, new Set(), 2).map((x) => x.id)).toEqual(["c1", "at1", "c2", "b1", "n1"]);
  });

  it("does not restrict a single-sport page", () => {
    expect(pickHeroArticles(pool.filter((x) => x.category === "cricket"), new Set(), null).map((x) => x.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("never drops a manual pick, even past the cap", () => {
    const manual = new Set(["c1", "c2", "c3"]);
    expect(pickHeroArticles([a("c1", "cricket"), a("c2", "cricket"), a("c3", "cricket"), ...pool.slice(4)], manual, 2).map((x) => x.id)).toEqual(["c1", "c2", "c3", "b1", "n1"]);
  });

  it("backfills from skipped candidates when the cap would leave the carousel short", () => {
    const onlyCricket = [a("c1", "cricket"), a("c2", "cricket"), a("c3", "cricket"), a("c4", "cricket")];
    expect(pickHeroArticles(onlyCricket, new Set(), 2, 4).map((x) => x.id)).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("counts sub-categories as their parent sport", () => {
    expect(pickHeroArticles([a("f1", "football"), a("f2", "football/world-cup"), a("f3", "football"), a("c1", "cricket")], new Set(), 2, 3).map((x) => x.id)).toEqual(["f1", "f2", "c1"]);
  });

  it("removes duplicate ids", () => {
    expect(pickHeroArticles([a("c1", "cricket"), a("c1", "cricket"), a("b1", "baseball")], new Set(), 2).map((x) => x.id)).toEqual(["c1", "b1"]);
  });
});
