import { describe, it, expect } from "vitest";
import { socialArticleUrl } from "./trackedLink";

describe("socialArticleUrl", () => {
  it("tags the article link with its social source", () => {
    const url = new URL(socialArticleUrl("https://sportswirelive.com", "some-story-123", "facebook"));
    expect(url.pathname).toBe("/article/some-story-123");
    expect(url.searchParams.get("utm_source")).toBe("facebook");
    expect(url.searchParams.get("utm_medium")).toBe("social");
  });
});
