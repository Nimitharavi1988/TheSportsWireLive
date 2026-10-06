import { describe, it, expect } from "vitest";
import { candidatePeople, isUsablePhoto, pickUsablePhoto } from "./autoDraftRules";
import { splitPackedText } from "./paidReview";
import type { PhotoResult } from "../photoSearch";

const photo = (title: string, width = 1600, height = 1000): PhotoResult => ({ id: title, source: "commons", title, creator: "x", license: "CC BY", landingUrl: "u", sourceName: "Wikimedia Commons", thumbUrl: "t", importUrl: "i", width, height } as PhotoResult);

describe("clean draft photos", () => {
  it("rejects the kinds of file the first drafts got", () => {
    for (const bad of [
      "Buffalo_Bills_Uniforms_2021-Present.png",
      "1958_topps_phila_eagles_team.jpg",
      "San_Francisco_49ers_headquarters.jpg",
      "Carolina_Panthers_logo_at_Tottenham_Hotspur_Stadium.jpg",
      "Houston_Texans_Uniforms_2024-Present.png",
      "Saquon_Barkley_2012.jpg", // too old to be this week's story
    ]) expect(isUsablePhoto(photo(bad))).toBe(false);
  });
  it("accepts a recent photograph, and rejects a small one", () => {
    expect(isUsablePhoto(photo("Saquon_Barkley_2023.jpg"))).toBe(true);
    expect(isUsablePhoto(photo("Tetairoa_McMillan_Carolina_Panthers.jpg"))).toBe(true);
    expect(isUsablePhoto(photo("Tetairoa_McMillan.jpg", 500, 400))).toBe(false);
  });
  it("picks the first usable photo that names the subject", () => {
    const results = [photo("Washington_Football_Team_vs._New_Orleans_Saints_2021.jpg"), photo("Falcons_uniforms.png"), photo("Kyle_Pitts_Atlanta_Falcons_2023.jpg"), photo("Kyle_Pitts_2019.jpg")];
    expect(pickUsablePhoto(results, "Kyle Pitts")?.title).toBe("Kyle_Pitts_Atlanta_Falcons_2023.jpg");
    expect(pickUsablePhoto(results, "Atlanta Falcons")?.title).toBe("Kyle_Pitts_Atlanta_Falcons_2023.jpg");
    expect(pickUsablePhoto([photo("Washington_Football_Team_vs._New_Orleans_Saints_2021.jpg")], "Atlanta Falcons")).toBeNull();
  });
  it("finds the people a story names more than once, most mentioned first, and not the clubs", () => {
    const body = "Tetairoa McMillan caught 11 passes. McMillan scored twice. Jared Goff passed for 412 yards, and Goff was sacked. The Carolina Panthers beat the Detroit Lions on Sunday Night Football. Carolina Panthers fans cheered. Bryce Young started 7-of-7.";
    expect(candidatePeople(body, ["Carolina Panthers", "Detroit Lions"])).toEqual(["Tetairoa McMillan", "Jared Goff"]);
    expect(candidatePeople("Tetairoa McMillan caught 11 passes. Tetairoa McMillan scored twice. Jared Goff passed. Jared Goff ran.", [])).toEqual(["Tetairoa McMillan", "Jared Goff"]);
  });
});

describe("a review that packs the corrected story into one field", () => {
  it("splits it back into headline, summary and body", () => {
    const packed = "Atlanta exposes New Orleans\nSummary: Atlanta won big.\nBody:\nFirst paragraph.\n\nSecond paragraph.";
    expect(splitPackedText(packed)).toEqual({ title: "Atlanta exposes New Orleans", summary: "Atlanta won big.", body: "First paragraph.\n\nSecond paragraph." });
    expect(splitPackedText("Just a headline")).toBeNull();
  });
});
