import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { differenceHash, hashDistance, isPromoBannerImage, isPromoCheckedUrl } from "./promoImages";

describe("promo banner screening", () => {
  it("only checks The Hockey News' image path, without fetching anything else", async () => {
    expect(isPromoCheckedUrl("https://media.zenfs.com/en/the_hockey_news_buffalo_sabres_articles_890/x.jpg")).toBe(true);
    expect(isPromoCheckedUrl("https://media.zenfs.com/en/usa_today_sports_articles_558/x.jpg")).toBe(false);
    expect(await isPromoBannerImage("https://example.com/photo.jpg")).toBe(false);
  });

  it("gives identical pictures distance 0 and different ones a large distance", async () => {
    const half = async (leftWhite: boolean) =>
      sharp({ create: { width: 90, height: 80, channels: 3, background: leftWhite ? "#fff" : "#000" } })
        .composite([{ input: { create: { width: 45, height: 80, channels: 3, background: leftWhite ? "#000" : "#fff" } }, left: 45, top: 0 }])
        .png().toBuffer();
    const a = await differenceHash(await half(true));
    expect(hashDistance(a, await differenceHash(await half(true)))).toBe(0);
    expect(hashDistance(a, await differenceHash(await half(false)))).toBeGreaterThan(5);
  });

  it("counts differing bits", () => {
    expect(hashDistance("0000", "1011")).toBe(3);
  });
});
