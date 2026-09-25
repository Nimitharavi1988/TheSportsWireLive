import { describe, it, expect } from "vitest";
import { imageWidthFromUrl, isHeroQualityImage, upgradeImageUrl } from "./imageQuality";

describe("upgradeImageUrl", () => {
  it("upgrades a BBC thumbnail to the full picture (real hero image, 2026-09-25)", () => {
    expect(upgradeImageUrl("https://ichef.bbci.co.uk/images/ic/240x135/p0m6ztjd.jpg")).toBe(
      "https://ichef.bbci.co.uk/images/ic/976x549/p0m6ztjd.jpg"
    );
  });

  it("leaves large BBC images and other hosts alone", () => {
    const big = "https://ichef.bbci.co.uk/images/ic/1024x576/p0abc.jpg";
    expect(upgradeImageUrl(big)).toBe(big);
    const ace = "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/a76c/live/x.jpg";
    expect(upgradeImageUrl(ace)).toBe(ace);
    const sky = "https://e0.365dm.com/26/09/768x432/skysports-x.jpg";
    expect(upgradeImageUrl(sky)).toBe(sky);
  });
});

describe("isHeroQualityImage", () => {
  it("accepts a real photo, including an upgradeable BBC thumbnail", () => {
    expect(isHeroQualityImage("https://ichef.bbci.co.uk/images/ic/240x135/p0m6ztjd.jpg")).toBe(true);
    expect(isHeroQualityImage("https://e0.365dm.com/26/09/768x432/skysports-x.jpg")).toBe(true);
  });

  it("rejects crests-only (no photo), stock fallback, bare domains and known-small images", () => {
    expect(isHeroQualityImage(null)).toBe(false);
    expect(isHeroQualityImage("https://images.pexels.com/photos/1/x.jpeg")).toBe(false);
    expect(isHeroQualityImage("https://p.imgci.com")).toBe(false);
    expect(isHeroQualityImage("https://example.com/img.jpg?w=300")).toBe(false);
    expect(isHeroQualityImage("not a url")).toBe(false);
  });

  it("reads widths from common URL shapes", () => {
    expect(imageWidthFromUrl("https://s.yimg.com/x/resizefill_w1200_h675;quality_80/y.jpg")).toBe(1200);
    expect(imageWidthFromUrl("https://cdn.example.com/a.jpg?width=480")).toBe(480);
    expect(imageWidthFromUrl("https://cdn.example.com/a.jpg")).toBeNull();
  });
});
