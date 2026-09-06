import { describe, it, expect } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rateLimit";

describe("checkRateLimit", () => {
  it("allows attempts up to the max, then blocks the next one", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
    }
    const sixth = checkRateLimit(key, 5, 60_000);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, 3, 60_000);
    expect(checkRateLimit(keyA, 3, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 3, 60_000).allowed).toBe(true);
  });

  it("resetRateLimit clears the bucket so attempts are allowed again", () => {
    const key = `reset-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    expect(checkRateLimit(key, 5, 60_000).allowed).toBe(false);

    resetRateLimit(key);

    expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
  });

  it("allows a fresh attempt again after the window expires", async () => {
    const key = `window-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 50);
    expect(checkRateLimit(key, 3, 50).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(checkRateLimit(key, 3, 50).allowed).toBe(true);
  });
});
