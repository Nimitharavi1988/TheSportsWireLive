import { describe, it, expect } from "vitest";
import { runPool } from "./pool";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("runPool", () => {
  it("runs every item, starting them in order", async () => {
    const started: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, () => [], async (n) => { started.push(n); await tick(5); });
    expect(started).toEqual([1, 2, 3, 4, 5]);
  });

  it("never runs more than the limit at once, and does overlap", async () => {
    let now = 0, peak = 0;
    await runPool(Array.from({ length: 10 }, (_, i) => i), 3, () => [], async () => {
      peak = Math.max(peak, ++now);
      await tick(10);
      now--;
    });
    expect(peak).toBe(3);
  });

  it("never runs two items with the same key together, and keeps their order", async () => {
    const log: string[] = [];
    let sameKeyNow = 0, overlapped = false;
    await runPool(["a1", "b1", "a2", "c1", "a3"], 3, (s) => [s[0]], async (s) => {
      if (s[0] === "a" && ++sameKeyNow > 1) overlapped = true;
      log.push(`start ${s}`);
      await tick(8);
      log.push(`end ${s}`);
      if (s[0] === "a") sameKeyNow--;
    });
    expect(overlapped).toBe(false);
    expect(log.indexOf("end a1")).toBeLessThan(log.indexOf("start a2"));
    expect(log.indexOf("end a2")).toBeLessThan(log.indexOf("start a3"));
    expect(log.filter((l) => l.startsWith("end")).length).toBe(5);
  });

  it("lets a later item start while an earlier one waits on a busy key", async () => {
    const log: string[] = [];
    await runPool(["a1", "a2", "b1"], 2, (s) => [s[0]], async (s) => { log.push(`start ${s}`); await tick(s === "a1" ? 20 : 2); });
    expect(log.slice(0, 2)).toEqual(["start a1", "start b1"]);
  });

  it("throws the first error after the in-flight items finish, and starts nothing new", async () => {
    const done: number[] = [];
    await expect(runPool([1, 2, 3, 4, 5, 6], 2, () => [], async (n) => {
      if (n === 2) { await tick(2); throw new Error("boom"); }
      await tick(10);
      done.push(n);
    })).rejects.toThrow("boom");
    expect(done).toContain(1);
    expect(done).not.toContain(6);
  });

  it("handles an empty list and a limit below one", async () => {
    await runPool([], 3, () => [], async () => { throw new Error("never"); });
    const seen: number[] = [];
    await runPool([1, 2], 0, () => [], async (n) => { seen.push(n); });
    expect(seen).toEqual([1, 2]);
  });
});
