import { describe, it, expect } from "vitest";
import { competitionToEntity } from "./competitionEntity";

describe("competitionToEntity", () => {
  it("formats a bilateral cricket series", () => {
    expect(competitionToEntity({ key: "india-vs-west-indies-odi", label: "India vs West Indies • ODI", category: "cricket" })).toMatchObject({
      kind: "series",
      slug: "india-vs-west-indies-odi",
      subtitle: "ODI series",
      href: "/series/india-vs-west-indies-odi",
      initials: "IW",
    });
  });

  it("labels a mixed-sport event as multi-sport", () => {
    expect(competitionToEntity({ key: "asian-games-2026", label: "Asian Games 2026", category: null })).toMatchObject({
      subtitle: "Multi-sport event",
      initials: "AG",
    });
  });

  it("labels a single-sport competition by its sport", () => {
    expect(competitionToEntity({ key: "ipl", label: "IPL", category: "cricket" })).toMatchObject({
      subtitle: "Cricket competition",
      initials: "IP",
    });
  });
});
