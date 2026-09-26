import { describe, it, expect } from "vitest";
import { sectionSport } from "./LiveTicker";

describe("sectionSport", () => {
  it("reads the sport from a section page", () => {
    expect(sectionSport("/sport/cricket")).toBe("cricket");
    expect(sectionSport("/sport/football/world-cup")).toBe("football");
    expect(sectionSport("/sport/american-football")).toBe("american-football");
  });

  it("is null elsewhere", () => {
    expect(sectionSport("/")).toBeNull();
    expect(sectionSport("/scores")).toBeNull();
    expect(sectionSport("/article/sport-story")).toBeNull();
    expect(sectionSport(null)).toBeNull();
  });
});
