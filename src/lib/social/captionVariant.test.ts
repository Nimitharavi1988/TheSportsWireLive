import { describe, expect, it } from "vitest";
import { captionVariantFor } from "./captionVariant";

describe("captionVariantFor", () => {
  it("is stable per story", () => {
    expect(captionVariantFor("abc123")).toBe(captionVariantFor("abc123"));
  });

  it("splits stories close to 50/50", () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `id${i}${(i * 7919).toString(36)}`);
    const hook = ids.filter((id) => captionVariantFor(id) === "hook").length;
    expect(hook / ids.length).toBeGreaterThan(0.45);
    expect(hook / ids.length).toBeLessThan(0.55);
  });
});
