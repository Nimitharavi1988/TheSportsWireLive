import { describe, expect, it } from "vitest";
import { selectFacebookHashtags, selectSpanishHashtags } from "./hashtagRepertoire";

describe("selectSpanishHashtags", () => {
  it("never uses English generic or sport-wide tags", () => {
    for (const [title, category] of [
      ["Cowboys vs Buccaneers: Score predictions for Week 5", "american-football"],
      ["MLB's proposed 154-game season would carve out new Monday games", "baseball"],
      ["Preview: App State Mountaineers vs Georgia Southern Eagles", "volleyball"],
    ] as const) {
      const tags = selectSpanishHashtags(title, category);
      expect(tags).not.toContain("#SportsNews");
      expect(tags).not.toContain("#AmericanFootball");
      expect(tags).not.toContain("#VolleyballNews");
      expect(tags.length).toBeLessThanOrEqual(3);
      expect(tags).toContain("#SportsWireLive");
    }
  });

  it("falls back to #Deportes when the headline names no player, club or fixture", () => {
    expect(selectSpanishHashtags("Cowboys vs Buccaneers: Score predictions for Week 5", "american-football")).toEqual(["#NFL", "#Deportes", "#SportsWireLive"]);
  });

  it("leaves the English Facebook hashtags as they were", () => {
    expect(selectFacebookHashtags("Cowboys vs Buccaneers: Score predictions for Week 5", "american-football").length).toBeGreaterThan(0);
  });
});
