import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRedditEngagement, weightForScore } from "./redditEngagement";

function redditResponse(posts: { title: string; score: number; stickied?: boolean }[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: { children: posts.map((p) => ({ data: p })) },
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("weightForScore", () => {
  it("gives a zero/near-zero score no weight", () => {
    expect(weightForScore(0)).toBe(0);
  });

  it("scales roughly logarithmically with upvotes", () => {
    expect(weightForScore(1023)).toBe(10); // log2(1024) = 10
  });

  it("caps at 15 for an outlier viral post", () => {
    expect(weightForScore(1_000_000)).toBe(15);
  });
});

describe("fetchRedditEngagement", () => {
  it("weights a tracked club mentioned in a hot post by its score", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/r/soccer/")) {
          return redditResponse([{ title: "Manchester City thrash rivals 4-0", score: 1023 }]);
        }
        return redditResponse([]);
      })
    );

    const engagement = await fetchRedditEngagement();
    expect(engagement.get("manchester city")).toBe(10);
  });

  it("ignores stickied posts (weekly threads, megathreads)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        redditResponse([{ title: "Manchester City daily discussion", score: 5000, stickied: true }])
      )
    );

    const engagement = await fetchRedditEngagement();
    expect(engagement.has("manchester city")).toBe(false);
  });

  it("ignores posts with zero or negative score", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => redditResponse([{ title: "Manchester City rumor thread", score: 0 }]))
    );

    const engagement = await fetchRedditEngagement();
    expect(engagement.has("manchester city")).toBe(false);
  });

  it("keeps the highest weight when a term appears in multiple posts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/r/soccer/")) {
          return redditResponse([
            { title: "Manchester City minor news", score: 1 },
            { title: "Manchester City wins the league!", score: 1023 },
          ]);
        }
        return redditResponse([]);
      })
    );

    const engagement = await fetchRedditEngagement();
    expect(engagement.get("manchester city")).toBe(10);
  });

  it("returns an empty map without throwing when a subreddit fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await expect(fetchRedditEngagement()).resolves.toEqual(new Map());
  });

  it("still returns data from a working subreddit when another returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/r/soccer/")) {
          return { ok: false, status: 429, json: async () => ({}) };
        }
        return redditResponse([{ title: "Kohli smashes a century", score: 1023 }]);
      })
    );

    const engagement = await fetchRedditEngagement();
    expect(engagement.get("kohli")).toBe(10);
  });
});
