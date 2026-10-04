import { describe, it, expect } from "vitest";
import { createCoverageIndex } from "./coverageIndex";
import { isSimilarTitle, sharesWords, significantWords } from "../titleSimilarity";

describe("coverage index", () => {
  const index = createCoverageIndex([
    { title: "YouTube preparing for NFL to potentially 'deconstruct' Sunday Ticket under next deal", category: "american-football" },
    { title: "Rishabh Pant-led Rest of India clinch Irani Cup, defeat J&K by 167 runs in Srinagar", category: "cricket" },
  ]);

  it("recognises another outlet's headline on the same event", () => {
    expect(index.isCovered("YouTube believes NFL could \"deconstruct\" Sunday Ticket in next broadcast deal", "american-football")).toBe(true);
    expect(index.isCovered("Rest of India clinch Irani Cup after beating J&K by 167 runs", "cricket")).toBe(true);
  });

  it("does not merge different games that share a template", () => {
    const i = createCoverageIndex([{ title: "Ohio State Put on Upset Alert Before Iowa Game", category: "college-football" }]);
    expect(i.isCovered("Florida Put on Upset alert Before Playing No 25 Mizzou", "college-football")).toBe(false);
  });

  it("only compares within a sport, and counts sub-categories as the sport", () => {
    expect(index.isCovered("Rest of India clinch Irani Cup after beating J&K by 167 runs", "american-football")).toBe(false);
    const i = createCoverageIndex([{ title: "Rest of India clinch Irani Cup after beating J&K by 167 runs", category: "cricket/domestic" }]);
    expect(i.isCovered("Rishabh Pant-led Rest of India clinch Irani Cup, defeat J&K by 167 runs", "cricket")).toBe(true);
  });

  it("learns each story as it is written, so later repeats in the same run are caught", () => {
    const i = createCoverageIndex();
    const title = "Sunil Gavaskar unhappy with Rohit Sharma's 92 vs West Indies: 'He might quit cricket'";
    expect(i.isCovered(title, "cricket")).toBe(false);
    i.add(title, "cricket");
    expect(i.isCovered("Sunil Gavaskar on Rohit Sharma's 92 vs West Indies and quitting cricket", "cricket")).toBe(true);
  });
});

describe("title similarity helpers", () => {
  it("keeps the social-posting behaviour unchanged", () => {
    expect(isSimilarTitle("Salah hits hat-trick against Galatasaray", "Salah hat-trick vs Galatasaray as Liverpool win")).toBe(true);
    expect(isSimilarTitle("Colorado Rockies 4-5 Seattle Mariners", "Rockies beat Mariners")).toBe(false);
  });

  it("takes a custom overlap floor", () => {
    const a = significantWords("Pant lifts Irani Cup trophy");
    const b = significantWords("Pant lifts Irani Cup after win");
    expect(sharesWords(a, b, 0.6, 3)).toBe(true);
    expect(sharesWords(a, b, 0.6, 5)).toBe(false);
  });
});
