import { describe, it, expect } from "vitest";
import { displaySummary, splitIntoParagraphs } from "./articleSummary";

describe("displaySummary", () => {
  it("falls back to summary when body is null", () => {
    expect(displaySummary({ summary: "Full coverage from BBC Sport.", body: null })).toBe(
      "Full coverage from BBC Sport."
    );
  });

  it("uses body as-is when it's within the length limit", () => {
    const body = "Arsenal beat Chelsea 2-1 at the Emirates.";
    expect(displaySummary({ summary: "generic", body }, 200)).toBe(body);
  });

  it("truncates a long body at a word boundary with an ellipsis", () => {
    const body = "Arsenal maintained their flawless start to the Premier League season on Sunday, edging out Chelsea in a hard-fought 2-1 victory that leaves the Gunners on top of the table.";
    const result = displaySummary({ summary: "generic", body }, 60);
    expect(result.length).toBeLessThanOrEqual(61); // 60 + ellipsis char
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith(" …")).toBe(false); // no dangling space before ellipsis
  });
});

describe("splitIntoParagraphs", () => {
  it("keeps real paragraph breaks intact when the text already has them", () => {
    const text = "First paragraph here.\n\nSecond paragraph here.";
    expect(splitIntoParagraphs(text)).toEqual(["First paragraph here.", "Second paragraph here."]);
  });

  it("leaves a short single block as one paragraph", () => {
    const text = "Arsenal beat Chelsea 2-1 at the Emirates on Sunday.";
    expect(splitIntoParagraphs(text)).toEqual([text]);
  });

  // Real example caught live (2026-09-12): Gemini's commentary came back as
  // one unbroken 3-sentence, ~380-char block with no paragraph breaks at
  // all, rendering as a dense wall of text.
  it("regroups a long unbroken block into smaller ~2-sentence paragraphs", () => {
    const text =
      "Ruben Dias, recently appointed as Manchester City's captain, has offered his perspective on the club's ongoing transition ahead of the upcoming campaign. He highlighted that the players acquired during the summer transfer window possess a deep hunger for success. Dias added that the entire roster has fully committed to the tactical philosophy and vision introduced by incoming manager Enzo Maresca.";
    const result = splitIntoParagraphs(text);
    expect(result.length).toBeGreaterThan(1);
    // Every sentence survives, in order, nothing dropped or duplicated.
    expect(result.join(" ")).toBe(text);
  });

  it("filters out empty lines from real paragraph breaks", () => {
    const text = "First.\n\n\n\nSecond.";
    expect(splitIntoParagraphs(text)).toEqual(["First.", "Second."]);
  });
});

describe("splitIntoParagraphs never drops text", () => {
  const letters = (s: string) => s.replace(/\s+/g, "");

  it("keeps a sentence whose period isn't followed by a space (real article, 2026-09-24)", () => {
    const body =
      "Analyst predictions suggest the Detroit Lions could pursue a blockbuster trade with the Pittsburgh Steelers involving wide receiver Jameson Williams, cornerback Joey Porter Jr., and pass catcher DK Metcalf. Such a deal would reshape the roster for Detroit general manager Brad Holmes, while Pittsburgh adjusts to early offensive struggles under quarterback Aaron Rodgers.";
    const paragraphs = splitIntoParagraphs(body);
    expect(paragraphs[0]).toMatch(/^Analyst predictions suggest the Detroit Lions/);
    expect(letters(paragraphs.join(" "))).toBe(letters(body));
  });

  it("keeps decimals, abbreviations and missing final punctuation", () => {
    const body =
      "India won by 3.5 wickets in the U.S. opener after a No.1 ranked side collapsed early on a slow pitch that nobody expected. " +
      "The captain said the team had prepared for weeks and the result reflected that work across every department of the game. " +
      "Next up is a trip to Lucknow where conditions should suit the spinners and the batting line-up will be tested again later this month";
    expect(body.length).toBeGreaterThan(320);
    expect(letters(splitIntoParagraphs(body).join(" "))).toBe(letters(body));
  });
});
