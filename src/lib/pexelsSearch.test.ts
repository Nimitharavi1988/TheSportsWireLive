import { describe, it, expect } from "vitest";
import { fromPexels } from "./photoSearch";

const photo = (over: Record<string, unknown> = {}) => ({
  id: 123, width: 4000, height: 2667, url: "https://www.pexels.com/photo/cricket-match-123/", photographer: "Jane Doe", alt: "Cricket   batsman playing a shot",
  src: { original: "https://images.pexels.com/photos/123/o.jpeg", large2x: "https://images.pexels.com/photos/123/l2.jpeg?w=940", large: "https://images.pexels.com/photos/123/l.jpeg", medium: "https://images.pexels.com/photos/123/m.jpeg" },
  ...over,
});

describe("fromPexels", () => {
  it("maps a result, labels it as stock and credits the photographer", () => {
    const r = fromPexels(photo())!;
    expect(r.title).toBe("Stock photo: Cricket batsman playing a shot");
    expect(r.sourceName).toBe("Pexels");
    expect(r.license).toBe("Pexels License");
    expect(r.credit).toBe("Photo by Jane Doe (Pexels License), via Pexels");
    expect(r.importUrl).toContain("l2.jpeg");
    expect(r.source).toBe("pexels");
  });
  it("copes with no alt text or photographer, and rejects an unusable result", () => {
    const r = fromPexels(photo({ alt: "", photographer: "" }))!;
    expect(r.title).toBe("Stock photo: Pexels photo");
    expect(r.creator).toBe("Unknown author");
    expect(fromPexels(photo({ src: {} }))).toBeNull();
    expect(fromPexels(photo({ url: "" }))).toBeNull();
  });
  it("is never accepted by the automatic draft photo picker (Commons only)", async () => {
    const { isUsablePhoto } = await import("./stories/autoDraftRules");
    const r = fromPexels(photo())!;
    expect(isUsablePhoto({ ...r, importUrl: "https://images.pexels.com/photos/123/l2.jpg" })).toBe(false);
  });
});
