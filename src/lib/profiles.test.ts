import { describe, expect, it } from "vitest";
import { profileProblems } from "./profilesRules";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("profileProblems", () => {
  it("accepts a profile of the right length that names the player", () => {
    expect(profileProblems("Lionel Messi", `Messi ${words(120)}`)).toEqual([]);
  });
  it("rejects short, long, gappy and nameless text", () => {
    expect(profileProblems("Lionel Messi", `Messi ${words(20)}`)[0]).toMatch(/too short/);
    expect(profileProblems("Lionel Messi", `Messi ${words(300)}`)[0]).toMatch(/too long/);
    expect(profileProblems("Lionel Messi", `Messi [check] ${words(120)}`)).toContain("has a note or gap in the text");
    expect(profileProblems("Lionel Messi", words(120))).toContain("never names the player");
  });
});
