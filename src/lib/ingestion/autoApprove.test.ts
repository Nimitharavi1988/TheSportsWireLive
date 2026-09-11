import { describe, it, expect } from "vitest";
import { hasRealImage, isAutoApprovable } from "./autoApprove";

describe("hasRealImage", () => {
  it("treats a team crest pair as a real image", () => {
    expect(hasRealImage({ heroImageUrl: null, homeCrestUrl: "https://crests.football-data.org/1.png" })).toBe(true);
  });

  it("treats a non-Pexels heroImageUrl as a real image (publisher photo, player photo, etc.)", () => {
    expect(hasRealImage({ heroImageUrl: "https://ichef.bbci.co.uk/photo.jpg", homeCrestUrl: null })).toBe(true);
    expect(hasRealImage({ heroImageUrl: "https://thumb.wikimedia.org/photo.jpg", homeCrestUrl: null })).toBe(true);
  });

  it("does not treat a generic Pexels stock photo as a real image", () => {
    expect(hasRealImage({ heroImageUrl: "https://images.pexels.com/photos/1/stock.jpeg", homeCrestUrl: null })).toBe(false);
  });

  it("does not treat no image at all as a real image", () => {
    expect(hasRealImage({ heroImageUrl: null, homeCrestUrl: null })).toBe(false);
  });
});

describe("isAutoApprovable", () => {
  const realBody = "A".repeat(200);
  const thinBody = "Too short.";
  const realImage = { heroImageUrl: "https://ichef.bbci.co.uk/photo.jpg", homeCrestUrl: null };
  const stockImage = { heroImageUrl: "https://images.pexels.com/photos/1/stock.jpeg", homeCrestUrl: null };

  it("approves an article with a real substantive body and a real image", () => {
    expect(isAutoApprovable({ body: realBody, ...realImage, playerNewsSourced: false })).toBe(true);
  });

  it("rejects a non-player-news article with no body at all", () => {
    expect(isAutoApprovable({ body: null, ...realImage, playerNewsSourced: false })).toBe(false);
  });

  it("rejects an article whose body is too short (a bare template, not real commentary)", () => {
    expect(isAutoApprovable({ body: thinBody, ...realImage, playerNewsSourced: false })).toBe(false);
  });

  it("rejects an article with a real body but only a generic stock photo", () => {
    expect(isAutoApprovable({ body: realBody, ...stockImage, playerNewsSourced: false })).toBe(false);
  });

  it("rejects an article with neither a real body nor a real image", () => {
    expect(isAutoApprovable({ body: null, ...stockImage, playerNewsSourced: false })).toBe(false);
  });

  it("counts a crest-based match article with a real body as approvable", () => {
    expect(
      isAutoApprovable({ body: realBody, heroImageUrl: null, homeCrestUrl: "https://crests.football-data.org/1.png", playerNewsSourced: false })
    ).toBe(true);
  });

  it("approves a player-news item with no body at all, as long as it has a real image", () => {
    expect(isAutoApprovable({ body: null, ...realImage, playerNewsSourced: true })).toBe(true);
  });

  it("still rejects a player-news item with only a generic stock photo", () => {
    expect(isAutoApprovable({ body: null, ...stockImage, playerNewsSourced: true })).toBe(false);
  });
});
