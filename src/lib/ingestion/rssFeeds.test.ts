import { describe, it, expect } from "vitest";
import { extractRssImage } from "./rssFeeds";

describe("extractRssImage", () => {
  it("extracts a BBC-style media:thumbnail (single object, attribute-only)", () => {
    const entry = {
      mediaThumbnail: { $: { width: "240", height: "135", url: "https://ichef.bbci.co.uk/example.jpg" } },
    };
    expect(extractRssImage(entry)).toEqual({ url: "https://ichef.bbci.co.uk/example.jpg", credit: undefined });
  });

  it("extracts an ESPN Cricinfo-style single media:content (not an array), upgraded to https", () => {
    const entry = {
      mediaContent: { $: { medium: "image", url: "http://p.imgci.com/example.jpg", width: "1400", height: "984" } },
    };
    expect(extractRssImage(entry)?.url).toBe("https://p.imgci.com/example.jpg");
  });

  it("picks the largest of several Guardian-style media:content size variants, with credit", () => {
    const entry = {
      mediaContent: [
        { $: { width: "140", url: "https://i.guim.co.uk/w140.jpg" }, "media:credit": [{ _: "Photograph: Mike Egerton/PA" }] },
        { $: { width: "700", url: "https://i.guim.co.uk/w700.jpg" }, "media:credit": [{ _: "Photograph: Mike Egerton/PA" }] },
        { $: { width: "460", url: "https://i.guim.co.uk/w460.jpg" }, "media:credit": [{ _: "Photograph: Mike Egerton/PA" }] },
      ],
    };
    expect(extractRssImage(entry)).toEqual({
      url: "https://i.guim.co.uk/w700.jpg",
      credit: "Photograph: Mike Egerton/PA",
    });
  });

  it("falls back to a plain <coverImages> string when nothing else is present", () => {
    expect(extractRssImage({ coverImages: "https://p.imgci.com/cover.jpg" })).toEqual({
      url: "https://p.imgci.com/cover.jpg",
      credit: undefined,
    });
  });

  it("prefers media:content over media:thumbnail when a feed somehow has both", () => {
    const entry = {
      mediaThumbnail: { $: { url: "https://example.com/thumb.jpg" } },
      mediaContent: { $: { url: "https://example.com/content.jpg", width: "700" } },
    };
    expect(extractRssImage(entry)?.url).toBe("https://example.com/content.jpg");
  });

  it("extracts a Sky Sports-style standard RSS <enclosure>", () => {
    const entry = { enclosure: { type: "image/jpg", url: "https://e2.365dm.com/example.jpg", length: "123456" } };
    expect(extractRssImage(entry)).toEqual({ url: "https://e2.365dm.com/example.jpg" });
  });

  it("ignores a non-image enclosure", () => {
    expect(extractRssImage({ enclosure: { type: "audio/mpeg", url: "https://example.com/ep.mp3" } })).toBeNull();
  });

  it("returns null when a feed entry has no image field at all", () => {
    expect(extractRssImage({})).toBeNull();
  });
});
