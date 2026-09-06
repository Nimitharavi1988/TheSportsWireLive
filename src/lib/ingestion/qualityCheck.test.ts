import { describe, it, expect } from "vitest";
import { runQualityChecks } from "./qualityCheck";

function flagged(text: string) {
  return runQualityChecks(text, text).profanityFlag;
}

describe("runQualityChecks — profanity detection", () => {
  it("does not flag clean sports content", () => {
    expect(flagged("Arsenal wins big game against Chelsea")).toBe(false);
  });

  it("does not flag the classic 'Scunthorpe problem' substring trap", () => {
    expect(flagged("Scunthorpe United beat Grimsby Town")).toBe(false);
  });

  it("does not flag other substring traps (classic/assist, Cockburn)", () => {
    expect(flagged("The classic assist from midfield was superb")).toBe(false);
    expect(flagged("Cockburn scored the winning goal")).toBe(false);
  });

  it("does not merge two innocent adjacent words into a false match", () => {
    expect(flagged("Boris hit the winning shot")).toBe(false);
  });

  it("deliberately excludes short/collision-prone words like 'hell'", () => {
    expect(flagged("What a hell of a match that was")).toBe(false);
  });

  it("flags plain profanity", () => {
    expect(flagged("That referee is a fucking disgrace")).toBe(true);
    expect(flagged("This is bullshit")).toBe(true);
  });

  it("flags leet-speak substitution", () => {
    expect(flagged("What the sh1t was that call")).toBe(true);
    expect(flagged("He is such an a$$hole")).toBe(true);
  });

  it("flags a censor symbol standing in for one letter", () => {
    expect(flagged("That was f*cking awful")).toBe(true);
    expect(flagged("f#*k this decision")).toBe(true);
  });

  it("flags punctuation-separated letters", () => {
    expect(flagged("f-u-c-k this ref")).toBe(true);
    expect(flagged("s.h.i.t performance today")).toBe(true);
  });

  it("flags letter-spam even with no punctuation at all", () => {
    expect(flagged("This is bullshiiiit honestly")).toBe(true);
  });
});

describe("runQualityChecks — broken scrape detection", () => {
  it("flags leftover HTML tags", () => {
    expect(runQualityChecks("Title", "<p>Some text</p>").passed).toBe(false);
  });

  it("flags a suspiciously short summary", () => {
    expect(runQualityChecks("Title", "short").passed).toBe(false);
  });

  it("passes a normal, valid summary", () => {
    expect(
      runQualityChecks("Arsenal beat Chelsea", "Arsenal beat Chelsea 2-1 at the Emirates Stadium.").passed
    ).toBe(true);
  });

  it("does not fail valid short match sentences on readability grounds", () => {
    // Flesch Reading Ease penalizes long foreign team names like
    // "Internazionale" the same way it penalizes garbled text — readability
    // must never be a pass/fail gate (informational only).
    const result = runQualityChecks(
      "Real Madrid CF vs FC Internazionale Milano",
      "Real Madrid CF face FC Internazionale Milano in the UEFA Champions League."
    );
    expect(result.passed).toBe(true);
  });
});
