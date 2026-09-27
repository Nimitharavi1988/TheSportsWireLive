import { describe, it, expect } from "vitest";
import { cricketFixtureTag, personHashtag, selectIndiaCricketHashtags } from "./hashtagRepertoire";

describe("India cricket Page hashtags", () => {
  it("tags the fixture, India first", () => {
    expect(cricketFixtureTag("IND vs WI 1st ODI: Naman Dhir makes India debut")).toBe("#INDvWI");
    expect(cricketFixtureTag("West Indies collapse as India win by 8 wickets")).toBe("#INDvWI");
    expect(cricketFixtureTag("Afghanistan vs India, Asian Games")).toBe("#INDvAFG");
    expect(cricketFixtureTag("England beat Sri Lanka at the Oval")).toBeNull();
    expect(cricketFixtureTag("India A v Australia A")).toBeNull();
  });

  it("tags the player the headline leads with", () => {
    expect(selectIndiaCricketHashtags("Justin Greaves, John Campbell create history in Gill's first series")[0]).toBe("#JustinGreaves");
  });

  it("makes a hashtag from a name", () => {
    expect(personHashtag("Virat Kohli")).toBe("#ViratKohli");
    expect(personHashtag("Jürgen Klopp")).toBe("#JurgenKlopp");
    expect(personHashtag("A'ja Wilson")).toBe("#AjaWilson");
  });

  it("picks fixture, player and #TeamIndia, three at most", () => {
    expect(selectIndiaCricketHashtags("1st ODI: Virat, Shubman centuries power India to 8-wicket win over West Indies")).toEqual(["#INDvWI", "#TeamIndia", "#CricketNews"]);
    expect(selectIndiaCricketHashtags("IND vs WI: Shubman Gill slams 10th ODI century")).toEqual(["#INDvWI", "#ShubmanGill", "#TeamIndia"]);
    expect(selectIndiaCricketHashtags("Kohli, Gill tons ace the chase after Kuldeep's 4-for")).toEqual(["#ViratKohli", "#TeamIndia", "#CricketNews"]);
    expect(selectIndiaCricketHashtags("Virat Kohli breaks Azharuddin's record")).toEqual(["#ViratKohli", "#TeamIndia", "#CricketNews"]);
    expect(selectIndiaCricketHashtags("BCCI announces title sponsor")).toEqual(["#TeamIndia", "#CricketNews", "#Cricket"]);
  });
});
