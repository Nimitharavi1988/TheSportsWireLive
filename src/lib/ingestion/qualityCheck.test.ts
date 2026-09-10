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

describe("runQualityChecks — non-news filler detection", () => {
  function titlePassed(title: string) {
    return runQualityChecks(title, "A summary long enough to pass the broken-scrape length check.").passed;
  }

  it("flags real filler titles found in production", () => {
    expect(titlePassed("Flex your football brain with our daily quizzes")).toBe(false);
    expect(titlePassed("Sports quiz of the week: transfer deadline day, the US Open and rugby drama")).toBe(false);
  });

  it("flags other common filler shapes", () => {
    expect(titlePassed("Crossword: Saturday's football-themed puzzle")).toBe(false);
    expect(titlePassed("How well do you know your Premier League history?")).toBe(false);
    expect(titlePassed("Vote: Player of the season")).toBe(false);
    expect(titlePassed("Sign up for our newsletter to get more like this")).toBe(false);
  });

  it("does not flag real tactical-analysis headlines that use 'puzzle' metaphorically", () => {
    // The same class of false-positive trap as the profanity list's
    // "Scunthorpe problem" — a real word inside a real headline, not filler.
    expect(titlePassed("Guardiola solves the puzzle of his misfiring front three")).toBe(true);
  });

  it("does not flag normal match reports", () => {
    expect(titlePassed("Arsenal beat Chelsea 2-1 at the Emirates")).toBe(true);
  });
});

describe("runQualityChecks — content-farm spam-ID detection", () => {
  function titlePassed(title: string) {
    return runQualityChecks(title, "A summary long enough to pass the broken-scrape length check.").passed;
  }

  it("flags the real spam title caught in production", () => {
    expect(
      titlePassed(
        "Pakistan Vs Australia 2nd T20 Live Match Today | PAK Vs AUS 2nd T20 Live Scores & Commentary Lewandowski (PdBBl3l0s4)"
      )
    ).toBe(false);
  });

  it("does not flag a real year in parentheses", () => {
    expect(titlePassed("Ballon d'Or nominees announced (2026)")).toBe(true);
  });

  it("does not flag a real short team/country code in parentheses", () => {
    expect(titlePassed("Player of the match (AUS)")).toBe(true);
  });

  it("does not flag a real word in parentheses", () => {
    expect(titlePassed("Watch the winning goal (video)")).toBe(true);
  });

  it("does not flag a normal headline with no trailing parenthetical at all", () => {
    expect(titlePassed("PSV 1-1 FK Shakhtar Donetsk")).toBe(true);
  });

  it("does not flag a parenthetical that only mixes two of the three character classes", () => {
    // Only letters (no digit) — a real abbreviation, not a bot ID.
    expect(titlePassed("Match preview (TBC)")).toBe(true);
    // Only lowercase + digit (no uppercase) — plausible real shorthand.
    expect(titlePassed("Season stats update (matchday3)")).toBe(true);
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
