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

  it("the main Page skips a story any topic Page already has, or it already has", () => {
    expect(reelNeeds([fb("india-cricket-reel")], { instagram: true, facebook: true }).needFacebook).toBe(false);
    expect(reelNeeds([fb("cricketlive-reel")], { instagram: true, facebook: true }).needFacebook).toBe(false);
    expect(reelNeeds([fb("reel")], { instagram: true, facebook: true }).needFacebook).toBe(false);
  });

  it("Instagram is independent of the Facebook reels", () => {
    expect(reelNeeds([fb("india-cricket-reel")], { instagram: true, facebook: true }).needInstagram).toBe(true);
    expect(reelNeeds([ig], { instagram: true, facebook: true }).needInstagram).toBe(false);
    expect(reelNeeds([ig], { instagram: true, facebook: true }).needFacebook).toBe(true);
  });
});
