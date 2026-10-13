import { describe, expect, it } from "vitest";
import { captionVariantFor, shortReelCaption } from "./captionVariant";

describe("shortReelCaption", () => {
  it("keeps the first sentence and drops the rest", () => {
    expect(shortReelCaption("Georgia has climbed to No. 1 in the AP poll. Click the link to see why.")).toBe("Georgia has climbed to No. 1 in the AP poll.");
  });
  it("cuts a long first sentence at the word limit", () => {
    const long = "word ".repeat(40).trim() + ".";
    const out = shortReelCaption(long, 22);
    expect(out.split(" ").length).toBe(22);
    expect(out.endsWith("…")).toBe(true);
  });
  it("leaves a short caption alone", () => {
    expect(shortReelCaption("Rodgers throws for 581 touchdowns!")).toBe("Rodgers throws for 581 touchdowns!");
  });
});

describe("captionVariantFor", () => {
  it("is stable per story and splits about half and half", () => {
    expect(captionVariantFor("abc")).toBe(captionVariantFor("abc"));
    const ids = Array.from({ length: 200 }, (_, i) => `id${i}x`);
    const hook = ids.filter((i) => captionVariantFor(i) === "hook").length;
    expect(hook).toBeGreaterThan(70);
    expect(hook).toBeLessThan(130);
  });
});
