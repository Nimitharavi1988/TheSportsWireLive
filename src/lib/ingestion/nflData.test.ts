import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchNflData } from "./nflData";

function scoreboardResponse(events: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ events }) };
}

function standingsResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      children: [
        {
          name: "American Football Conference",
          standings: {
            entries: [
              {
                team: { id: "1" },
                stats: [
                  { name: "wins", displayValue: "10" },
                  { name: "losses", displayValue: "2" },
                  { name: "ties", displayValue: "0" },
                  { name: "playoffSeed", displayValue: "1" },
                ],
              },
            ],
          },
        },
      ],
    }),
  };
}

function competitor(homeAway: "home" | "away", id: string, name: string, score: string) {
  return { homeAway, score, team: { id, displayName: name, logo: `https://example.com/${id}.png` } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchNflData", () => {
  it("builds a finished-result article with a score-based title and winner sentence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("scoreboard")) {
          return scoreboardResponse([
            {
              id: "e1",
              date: "2026-09-14T18:00Z",
              status: { type: { state: "post", completed: true } },
              competitions: [{ competitors: [competitor("home", "1", "Buffalo Bills", "27"), competitor("away", "2", "New York Jets", "14")] }],
            },
          ]);
        }
        return standingsResponse();
      })
    );

    const items = await fetchNflData();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Buffalo Bills 27-14 New York Jets",
      sourceName: "ESPN NFL",
      category: "american-football",
      homeCrestUrl: "https://example.com/1.png",
      awayCrestUrl: "https://example.com/2.png",
    });
    expect(items[0].body).toContain("Buffalo Bills won 27-14");
  });

  it("includes standings context (record + playoff seed) when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("scoreboard")) {
          return scoreboardResponse([
            {
              id: "e1",
              date: "2026-09-14T18:00Z",
              status: { type: { state: "post", completed: true } },
              competitions: [{ competitors: [competitor("home", "1", "Buffalo Bills", "27"), competitor("away", "2", "New York Jets", "14")] }],
            },
          ]);
        }
        return standingsResponse();
      })
    );

    const items = await fetchNflData();
    expect(items[0].body).toContain("Buffalo Bills are 10-2, seeded 1st in the American Football Conference");
  });

  it("builds a preview article for a scheduled (pre-game) event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("scoreboard")) {
          return scoreboardResponse([
            {
              id: "e2",
              date: "2026-09-21T18:00Z",
              status: { type: { state: "pre", completed: false } },
              competitions: [{ competitors: [competitor("home", "1", "Buffalo Bills", "0"), competitor("away", "2", "New York Jets", "0")] }],
            },
          ]);
        }
        return standingsResponse();
      })
    );

    const items = await fetchNflData();
    expect(items).toHaveLength(1);
    expect(items[0].title).toMatch(/^Preview: Buffalo Bills vs New York Jets/);
    expect(items[0].body).toContain("Kickoff is");
  });

  it("skips in-progress (live) games rather than producing a confusing snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("scoreboard")) {
          return scoreboardResponse([
            {
              id: "e3",
              date: "2026-09-14T18:00Z",
              status: { type: { state: "in", completed: false } },
              competitions: [{ competitors: [competitor("home", "1", "Buffalo Bills", "10"), competitor("away", "2", "New York Jets", "7")] }],
            },
          ]);
        }
        return standingsResponse();
      })
    );

    const items = await fetchNflData();
    expect(items).toHaveLength(0);
  });

  it("returns an empty list without throwing when the scoreboard fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await expect(fetchNflData()).resolves.toEqual([]);
  });
});
