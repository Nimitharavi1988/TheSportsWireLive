import { describe, expect, it } from "vitest";
import { reelNeeds } from "./reelDuplicates";

const fb = (destination: string) => ({ platform: "facebook", destination });
const ig = { platform: "instagram", destination: "reel" };

describe("reelNeeds: one Facebook reel per story across our Pages", () => {
  it("a fresh story needs every reel requested", () => {
    expect(reelNeeds([], { instagram: true, facebook: true })).toEqual({ needInstagram: true, needFacebook: true });
  });

  it("a topic Page skips a story the main Page already has, and one it already has", () => {
    expect(reelNeeds([fb("reel")], { instagram: false, facebook: true, topicKey: "india-cricket" }).needFacebook).toBe(false);
    expect(reelNeeds([fb("india-cricket-reel")], { instagram: false, facebook: true, topicKey: "india-cricket" }).needFacebook).toBe(false);
  });

  it("a topic Page is not blocked by another topic Page (that is notAlsoOn's job at selection)", () => {
    expect(reelNeeds([fb("india-cricket-reel")], { instagram: false, facebook: true, topicKey: "cricketlive" }).needFacebook).toBe(true);
  });

  it("the main Page is unchanged: only its own earlier reel stops it, never a topic Page's", () => {
    expect(reelNeeds([fb("india-cricket-reel")], { instagram: true, facebook: true }).needFacebook).toBe(true);
    expect(reelNeeds([fb("cricketlive-reel")], { instagram: true, facebook: true }).needFacebook).toBe(true);
    expect(reelNeeds([fb("reel")], { instagram: true, facebook: true }).needFacebook).toBe(false);
  });

  it("Instagram is independent of the Facebook reels", () => {
    expect(reelNeeds([fb("india-cricket-reel")], { instagram: true, facebook: true }).needInstagram).toBe(true);
    expect(reelNeeds([ig], { instagram: true, facebook: true }).needInstagram).toBe(false);
    expect(reelNeeds([ig], { instagram: true, facebook: true }).needFacebook).toBe(true);
  });

  it("a topic Page's Instagram skips a story it (or the main account) already has a reel of", () => {
    const own = { platform: "instagram", destination: "football-reel" };
    expect(reelNeeds([own], { instagram: true, facebook: true, topicKey: "football" }).needInstagram).toBe(false);
    expect(reelNeeds([ig], { instagram: true, facebook: true, topicKey: "football" }).needInstagram).toBe(false);
    expect(reelNeeds([own], { instagram: true, facebook: true, topicKey: "us-sports" }).needInstagram).toBe(true);
    expect(reelNeeds([own], { instagram: true, facebook: true }).needInstagram).toBe(true); // main account unchanged
  });
});

describe("reelNeeds with fanOut (a big match-day story goes to every related account)", () => {
  const own = { platform: "instagram", destination: "cricketlive-reel" };
  it("a topic Page is not blocked by the main Page's or another Page's reel, only by its own", () => {
    expect(reelNeeds([fb("reel"), fb("india-cricket-reel")], { instagram: false, facebook: true, topicKey: "cricketlive", fanOut: true }).needFacebook).toBe(true);
    expect(reelNeeds([fb("cricketlive-reel")], { instagram: false, facebook: true, topicKey: "cricketlive", fanOut: true }).needFacebook).toBe(false);
  });
  it("a topic Page's Instagram gets its own reel even when the main account already posted one", () => {
    expect(reelNeeds([ig], { instagram: true, facebook: true, topicKey: "cricketlive", fanOut: true }).needInstagram).toBe(true);
    expect(reelNeeds([own], { instagram: true, facebook: true, topicKey: "cricketlive", fanOut: true }).needInstagram).toBe(false);
  });
  it("the main account still counts only its own history", () => {
    expect(reelNeeds([fb("india-cricket-reel"), fb("cricketlive-reel")], { instagram: true, facebook: true, fanOut: true })).toEqual({ needInstagram: true, needFacebook: true });
    expect(reelNeeds([fb("reel"), ig], { instagram: true, facebook: true, fanOut: true })).toEqual({ needInstagram: false, needFacebook: false });
  });
  it("without fanOut nothing changes", () => {
    expect(reelNeeds([fb("reel")], { instagram: false, facebook: true, topicKey: "cricketlive" }).needFacebook).toBe(false);
  });
});
