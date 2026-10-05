import { describe, it, expect } from "vitest";
import { searchWords } from "./adminSearch";

describe("searchWords", () => {
  it("ignores punctuation, quote style and spacing, so a title typed with one space finds one stored with two", () => {
    // Stored (BBC Sport, 2026-10-04): Ronaldo still 'greatest symbol' of Portugal -  Fernandes
    expect(searchWords("Ronaldo still 'greatest symbol' of Portugal - Fernandes")).toEqual(
      ["ronaldo", "still", "greatest", "symbol", "of", "portugal", "fernandes"]
    );
    expect(searchWords("Ronaldo still ‘greatest symbol’ of Portugal – Fernandes")).toEqual(
      searchWords("Ronaldo still 'greatest symbol' of Portugal -  Fernandes")
    );
  });
  it("keeps accented letters and digits, drops duplicates, and caps the word count", () => {
    expect(searchWords("Mbappé Mbappé 2026")).toEqual(["mbappé", "2026"]);
    expect(searchWords("a b c d e f g h i j k l")).toHaveLength(8);
  });
  it("returns nothing for a query that is only punctuation", () => {
    expect(searchWords(" - ' % ")).toEqual([]);
    expect(searchWords("")).toEqual([]);
  });
});
