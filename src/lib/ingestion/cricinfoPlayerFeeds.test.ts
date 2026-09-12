import { describe, it, expect } from "vitest";
import { cricinfoPlayerFeedUrl } from "./cricinfoPlayerFeeds";

describe("cricinfoPlayerFeedUrl", () => {
  // Real, confirmed-live example (2026-09-12): Sanju Samson's own feed.
  it("builds the per-player feed URL from a numeric Cricinfo player ID", () => {
    expect(cricinfoPlayerFeedUrl(425943)).toBe("https://www.cricinfo.com/rss/content/story/feeds/425943.xml");
  });
});
