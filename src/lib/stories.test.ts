import { describe, it, expect } from "vitest";
import { authorSlug, isOriginalStory, publishProblems, storySlug, subheading, wordCount } from "./stories";

const ready = {
  title: "India v West Indies: what Greenfield's pitch means for the 1st ODI",
  summary: "Thiruvananthapuram's surface has favoured spin in recent seasons — here's how both sides are likely to line up.",
  body: "A".repeat(900),
  category: "cricket",
  heroImageUrl: "https://sportswirelive.com/media/stories/2026/09/abc.jpg",
};

describe("stories", () => {
  it("builds a clean, unique slug from the headline", () => {
    expect(storySlug("India v West Indies: 1st ODI preview!", 1790000000000)).toBe("india-v-west-indies-1st-odi-preview-1790000000000");
    expect(storySlug("!!!", 1)).toBe("story-1");
  });

  it("slugs an author name", () => {
    expect(authorSlug("Nimitha Ravi")).toBe("nimitha-ravi");
  });

  it("recognises the site's own stories", () => {
    expect(isOriginalStory({ sourceName: "Sports Wire Live" })).toBe(true);
    expect(isOriginalStory({ sourceName: "BBC Sport" })).toBe(false);
  });

  it("a complete story has nothing blocking publishing", () => {
    expect(publishProblems(ready, ["cricket", "football"])).toEqual([]);
  });

  it("lists everything missing before publishing", () => {
    const problems = publishProblems({ ...ready, title: "Short", body: "Too short", heroImageUrl: null, category: "" }, ["cricket"]);
    expect(problems).toHaveLength(4);
  });

  it("counts words and reads subheadings", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(wordCount("")).toBe(0);
    expect(subheading("## Team news")).toBe("Team news");
    expect(subheading("Not ## a heading")).toBeNull();
  });
});
