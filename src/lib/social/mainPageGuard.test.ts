// Guards the English main Page and its Instagram account. Their captions, hashtags,
// reel music and link format were checked identical to the code before the Page-group
// work (2,323 real stories compared on 2026-10-09). If one of these fails, a change
// reached the main Page: that needs an explicit decision, not just a new expected value.
// (Hashtags also move when the tracked player/club lists grow; update those two values then.)
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildSocialCaptionsPrompt } from "../ingestion/commentary";
import { selectFacebookHashtags, selectInstagramHashtags } from "./hashtagRepertoire";
import { musicStyleFor } from "./reelMusic";
import { socialArticleUrl } from "./trackedLink";

const CASES: [string, string][] = [
  ["Cowboys vs Buccaneers: Score predictions for Week 5", "american-football"],
  ["Caitlin Clark's absence puts WNBA crowds to the test", "wnba"],
  ["Rays sweep Yankees out of ALDS, Dodgers and Brewers advance to NLCS", "baseball"],
  ["Arsenal beat Tottenham 2-1 in the north London derby", "football"],
  ["Carlos Alcaraz wins second consecutive Tokyo title", "tennis"],
  ["Shreyas Iyer slams maiden T20I century as India beat West Indies", "cricket"],
];

describe("main Page guard", () => {
  it("Facebook hashtags", () => {
    expect(CASES.map(([t, c]) => selectFacebookHashtags(t, c))).toEqual([
      ["#NFL", "#AmericanFootball", "#SportsWireLive"],
      ["#CaitlinClark", "#WNBA", "#SportsWireLive"],
      ["#SportsNews", "#SportsWireLive"],
      ["#Arsenal", "#FootballNews", "#SportsWireLive"],
      ["#SportsNews", "#SportsWireLive"],
      ["#ShreyasIyer", "#CricketNews", "#SportsWireLive"],
    ]);
  });

  it("Instagram hashtags", () => {
    expect(CASES.map(([t, c]) => selectInstagramHashtags(t, c))).toEqual([
      ["#NFL", "#AmericanFootball", "#Gridiron", "#Touchdown", "#SportsNews", "#sportsWireLiveNews"],
      ["#CaitlinClark", "#WNBA", "#WNBAPlayoffs", "#Hoops", "#SportsNews", "#sportsWireLiveNews"],
      ["#SportsNews", "#sportsWireLiveNews"],
      ["#Arsenal", "#FootballNews", "#SoccerLife", "#SportsNews", "#sportsWireLiveNews"],
      ["#SportsNews", "#sportsWireLiveNews"],
      ["#ShreyasIyer", "#CricketNews", "#CricketFever", "#SportsNews", "#sportsWireLiveNews"],
    ]);
  });

  it("reel music rotation (the original seven styles, no story given)", () => {
    const ids = ["p8m1pjoempdxuumg2t10qmh1", "kb9hegvhmka3c27ggyit2pz4", "ofcecoqaz4k4tw8j5mtmvbhg", "l6a92ctonqkevo0hup4t3zcy", "abc123", "zzz"];
    expect(ids.map((i) => musicStyleFor(i))).toEqual(["ambient", "cinematic", "trap", "cinematic", "cinematic", "smooth"]);
  });

  it("the article link carries only the two standard tags", () => {
    expect(socialArticleUrl("https://sportswirelive.com", "some-story-123", "facebook")).toBe("https://sportswirelive.com/article/some-story-123?utm_source=facebook&utm_medium=social");
  });

  it("the English caption instructions (default, no style)", () => {
    const prompt = buildSocialCaptionsPrompt("Test headline", "Fact one. Fact two. Fact three about the game and the players involved here.");
    expect(createHash("sha1").update(prompt).digest("hex")).toBe("791b431ced118f0d2cc8d6cbd863cec27e693733");
  });
});
