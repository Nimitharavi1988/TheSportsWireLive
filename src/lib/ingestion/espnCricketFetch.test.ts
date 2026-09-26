import { describe, it, expect, vi, beforeEach } from "vitest";

const espnFetch = vi.fn();
vi.mock("../espnFetch", () => ({ espnFetch: (url: string) => espnFetch(url) }));

import { fetchEspnCricketData } from "./espnCricketData";

const event = (id: string, date: string, status = "pre") => ({
  id, date, status,
  competitors: [
    { homeAway: "home", displayName: "India" },
    { homeAway: "away", displayName: "West Indies" },
  ],
});
const header = (...events: object[]) => ({ ok: true, json: async () => ({ sports: [{ leagues: [{ name: "West Indies tour of India", events }] }] }) });

describe("fetchEspnCricketData", () => {
  beforeEach(() => {
    espnFetch.mockReset();
  });

  it("asks only for the current list by default (live refresh)", async () => {
    espnFetch.mockResolvedValue(header(event("1", "2026-09-26T08:30:00Z", "in")));
    const items = await fetchEspnCricketData();
    expect(espnFetch).toHaveBeenCalledTimes(1);
    expect(espnFetch.mock.calls[0][0]).not.toContain("dates=");
    expect(items).toHaveLength(1);
  });

  it("adds each upcoming day and keeps a multi-day event once", async () => {
    const now = new Date("2026-09-26T12:00:00Z");
    espnFetch.mockImplementation(async (url: string) => {
      if (!url.includes("dates=")) return header(event("test", "2026-09-24T09:30:00Z", "in"));
      if (url.includes("dates=20260927")) return header(event("test", "2026-09-24T09:30:00Z", "in"), event("odi1", "2026-09-27T08:30:00Z"));
      if (url.includes("dates=20260928")) return { ok: false, status: 500, json: async () => ({}) };
      return header();
    });
    const items = await fetchEspnCricketData(3, now);
    expect(espnFetch.mock.calls.map((c) => c[0].match(/dates=(\d+)/)?.[1] ?? "now")).toEqual(["now", "20260927", "20260928", "20260929"]);
    expect(items.map((i) => i.dedupeKey)).toEqual(["espn-cricket-test", "espn-cricket-odi1"]);
    expect(items[1].matchStatus).toBe("scheduled");
  });
});
