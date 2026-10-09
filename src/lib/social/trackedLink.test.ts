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

describe("socialArticleUrl content tag", () => {
  it("adds utm_content only when asked", () => {
    expect(new URL(socialArticleUrl("https://sportswirelive.com", "s", "facebook")).searchParams.has("utm_content")).toBe(false);
    expect(new URL(socialArticleUrl("https://sportswirelive.com", "s", "facebook", "hook")).searchParams.get("utm_content")).toBe("hook");
  });
});

describe("socialArticleUrl campaign tag", () => {
  it("adds utm_campaign only for a Page that asks, and keeps it with the content tag", () => {
    const plain = new URL(socialArticleUrl("https://sportswirelive.com", "s", "facebook"));
    expect(plain.searchParams.has("utm_campaign")).toBe(false);
    const tagged = new URL(socialArticleUrl("https://sportswirelive.com", "s", "facebook", "hook", "india-cricket"));
    expect(tagged.searchParams.get("utm_campaign")).toBe("india-cricket");
    expect(tagged.searchParams.get("utm_content")).toBe("hook");
    expect(tagged.searchParams.get("utm_source")).toBe("facebook");
  });
});
