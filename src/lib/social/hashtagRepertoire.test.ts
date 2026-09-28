import { describe, it, expect } from "vitest";
import { selectFacebookHashtags, selectInstagramHashtags } from "./hashtagRepertoire";

describe("selectFacebookHashtags", () => {
  it("caps at 3 tags", () => {
    const tags = selectFacebookHashtags("Cristiano Ronaldo scores twice as Premier League leaders win transfer saga continues", "football");
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  it("prioritizes the player tag first when a real player is mentioned", () => {
    const tags = selectFacebookHashtags("Messi scores a hat-trick", "football");
    expect(tags[0]).toBe("#LionelMessi");
  });

  it("does not attach an unrelated sport's tags", () => {
    const tags = selectFacebookHashtags("Virat Kohli hits a century", "cricket");
    expect(tags).not.toContain("#NBA");
    expect(tags).not.toContain("#NFL");
  });

  it("falls back to a general tag when no sport-specific list exists for the category", () => {
    const tags = selectFacebookHashtags("Some hockey headline", "hockey");
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]).toMatch(/^#(SportsNews|SportsUpdates|GameDay|MatchDay|SportsBlog|SportsHighlight|SportsMedia)$/);
  });
});

describe("selectInstagramHashtags", () => {
  it("includes conditional league tags only when the title actually mentions them", () => {
    const withPL = selectInstagramHashtags("Arsenal win big in Premier League clash", "football");
    expect(withPL).toContain("#PremierLeague");

    const withoutPL = selectInstagramHashtags("Arsenal sign new winger", "football");
    expect(withoutPL).not.toContain("#PremierLeague");
  });

  it("detects IPL mentions for cricket", () => {
    const tags = selectInstagramHashtags("Chennai Super Kings' IPL auction strategy revealed", "cricket");
    expect(tags).toContain("#IPL");
  });

  it("does not false-positive IPL on words containing the letters ipl", () => {
    const tags = selectInstagramHashtags("Players face discipline after multiple incidents", "cricket");
    expect(tags).not.toContain("#IPL");
  });

  it("matches accented player names (Mbappé) via the accent-agnostic term", () => {
    const tags = selectInstagramHashtags("Kylian Mbappé nets a brace for Real Madrid", "football");
    expect(tags).toContain("#KylianMbappe");
  });

  it("returns real matches without padding to a fixed count", () => {
    const tags = selectInstagramHashtags("Quiet news day headline with nothing special", "basketball");
    // base NBA tags always apply for this category, but no player/conditional match
    expect(tags).toEqual(expect.arrayContaining(["#NBA", "#BasketballNews", "#Hoops", "#BallIsLife"]));
    expect(tags).not.toContain("#LeBronJames");
  });
});

describe("brand hashtags", () => {
  it("ends every Facebook post with #SportsWireLive, keeping 3 tags", () => {
    const tags = selectFacebookHashtags("Virat Kohli hits a century in the IPL T20 final", "cricket");
    expect(tags).toEqual(["#ViratKohli", "#T20Cricket", "#SportsWireLive"]);
  });

  it("adds the brand tag even for a category with no sport-specific tags", () => {
    expect(selectFacebookHashtags("Some hockey headline", "hockey").at(-1)).toBe("#SportsWireLive");
  });

  it("adds #sportsWireLiveNews to Instagram on top of the topic tags", () => {
    const tags = selectInstagramHashtags("Kylian Mbappé nets a brace for Real Madrid", "football");
    expect(tags.at(-1)).toBe("#sportsWireLiveNews");
    expect(tags).toContain("#KylianMbappe");
    expect(tags.length).toBeLessThanOrEqual(30);
  });
});
