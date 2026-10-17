import { describe, it, expect } from "vitest";
import { columnDetail, cropFit, cropKeepsSubject } from "./reelCropFit";

// A w x h greyscale picture that is flat except for a busy block of columns (a "subject").
function picture(w: number, h: number, busyFrom: number, busyTo: number): Uint8Array {
  const g = new Uint8Array(w * h).fill(100);
  for (let y = 0; y < h; y++) for (let x = busyFrom; x < busyTo; x++) g[y * w + x] = (x + y) % 2 ? 20 : 220;
  return g;
}

describe("crop fit", () => {
  it("columnDetail is zero for a flat picture and high where the picture is busy", () => {
    const d = columnDetail(picture(40, 20, 10, 20), 40, 20);
    expect(d[2]).toBe(0);
    expect(d[12]).toBeGreaterThan(1000);
  });
  it("keeps the crop when the subject sits inside it", () => {
    const d = columnDetail(picture(100, 30, 30, 70), 100, 30);
    const fit = cropFit(d, 28, 45); // the crop covers the busy middle
    expect(fit.ratio).toBeLessThan(0.5);
    expect(cropKeepsSubject(fit)).toBe(true);
  });
  it("rejects the crop when the subject is at the edge and would be cut off", () => {
    const d = columnDetail(picture(100, 30, 0, 30), 100, 30); // the subject on the left
    const fit = cropFit(d, 28, 45); // the crop covers flat background
    expect(fit.ratio).toBeGreaterThan(1);
    expect(cropKeepsSubject(fit)).toBe(false);
  });
  it("a uniformly busy picture is fine (ratio about 1)", () => {
    const d = columnDetail(picture(100, 30, 0, 100), 100, 30);
    expect(cropFit(d, 28, 45).ratio).toBeCloseTo(1, 1);
  });
  it("handles a degenerate crop", () => {
    expect(cropFit([5, 5, 5], 0, 0).ratio).toBe(Infinity);
    expect(cropFit([], 0, 0).ratio).toBe(1);
  });
});
