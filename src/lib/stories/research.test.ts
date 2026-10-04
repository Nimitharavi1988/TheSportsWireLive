import { describe, it, expect } from "vitest";
import { buildCheckPrompt, buildResearchPrompt, groundingSources, parseFacts } from "./research";
import { editorNotes, pickFormat, pickPhoto, suggestedWriter } from "./autoDraftRules";
import type { PhotoResult } from "../photoSearch";

describe("research", () => {
  it("keeps only the FACT: lines, cleaned", () => {
    const text = "Here is what I found:\nFACT: Rays beat the Yankees 1-0 in ALDS Game 1 on October 3.\n- FACT:   Drew Rasmussen struck out 10 in eight innings.\nFACT: short\nSome closing remark.";
    expect(parseFacts(text)).toEqual([
      "Rays beat the Yankees 1-0 in ALDS Game 1 on October 3.",
      "Drew Rasmussen struck out 10 in eight innings.",
    ]);
  });

  it("lists each source once, by title", () => {
    expect(groundingSources([{ web: { uri: "x", title: "mlb.com" } }, { web: { uri: "y", title: "mlb.com" } }, { web: { title: "espn.com" } }, {}])).toEqual(["mlb.com", "espn.com"]);
    expect(groundingSources(undefined)).toEqual([]);
  });

  it("puts the date, the story and the facts into the prompts", () => {
    expect(buildResearchPrompt("Rays take Game 1", "How Rasmussen did it", new Date("2026-10-04T12:00:00Z"))).toContain("Today is 4 October 2026");
    expect(buildCheckPrompt(["Rays won 1-0"], "The Rays won 2-0.")).toContain("- Rays won 1-0");
  });
});

describe("automatic draft extras", () => {
  it("suggests a writer by beat, with a default", () => {
    expect(suggestedWriter("cricket")).toBe("Robin");
    expect(suggestedWriter("tennis")).toBe("Abhinav Earnest");
  });

  it("picks a format that suits the idea", () => {
    expect(pickFormat("preview", 0)).toBe("feature");
    expect(pickFormat("report", 0.99)).toBe("reportCard");
    expect(pickFormat("unknown", 0)).toBe("qa");
  });

  it("only takes a photo whose title names the subject", () => {
    const photo = (title: string) => ({ title } as PhotoResult);
    expect(pickPhoto([photo("Cricket stadium crowd"), photo("Shubman Gill 2023")], "Shubman Gill")?.title).toBe("Shubman Gill 2023");
    expect(pickPhoto([photo("Cricket stadium crowd")], "Shubman Gill")).toBeNull();
  });

  it("writes the editor's notes", () => {
    const notes = editorNotes({ writer: "Robin", sources: ["espncricinfo.com"], removed: 2, photoSubject: "Shubman Gill" });
    expect(notes[0]).toContain("Suggested writer: Robin");
    expect(notes.join(" ")).toContain("removed or corrected 2 claims");
    expect(notes.at(-1)).toBe("Researched from: espncricinfo.com.");
    expect(editorNotes({ writer: "Robin", sources: [], removed: 0, photoSubject: null })).toHaveLength(1);
  });
});
