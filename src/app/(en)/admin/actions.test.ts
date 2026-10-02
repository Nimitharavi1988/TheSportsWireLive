import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSession,
  mockUpdate,
  mockUpdateMany,
  mockFindMany,
  mockFindUnique,
  mockPostArticleToFacebook,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockPostArticleToFacebook: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    article: {
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
    },
  },
}));
vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/social/facebook", () => ({ postArticleToFacebook: mockPostArticleToFacebook }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import {
  approveArticle,
  approveArticles,
  approveAllMatching,
  rejectArticle,
  featureArticle,
  unfeatureArticle,
  highlightArticle,
  unhighlightArticle,
  unflagArticle,
} from "./actions";
import { HERO_CAP } from "@/lib/heroConfig";

const SESSION = { userId: "admin-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(SESSION);
  mockUpdate.mockResolvedValue({});
  mockUpdateMany.mockResolvedValue({ count: 0 });
  mockFindMany.mockResolvedValue([]);
  mockFindUnique.mockResolvedValue({ category: "football" });
  mockPostArticleToFacebook.mockResolvedValue(undefined);
});

describe("approveArticle", () => {
  it("throws and makes no changes when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(approveArticle("a1")).rejects.toThrow("Not authenticated");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("publishes the article, stamping reviewer info", async () => {
    await approveArticle("a1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: expect.objectContaining({
        status: "published",
        reviewedBy: SESSION.userId,
        reviewedAt: expect.any(Date),
      }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("never overwrites publishedAt — it already holds the real source date from ingestion", async () => {
    await approveArticle("a1");
    const [{ data }] = mockUpdate.mock.calls[0];
    expect(data).not.toHaveProperty("publishedAt");
  });

  it("posts to Facebook after approving", async () => {
    await approveArticle("a1");
    expect(mockPostArticleToFacebook).toHaveBeenCalledWith("a1");
  });

  it("still succeeds when the Facebook post fails", async () => {
    mockPostArticleToFacebook.mockRejectedValue(new Error("FB API down"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(approveArticle("a1")).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("approveArticles (bulk)", () => {
  it("throws and makes no changes when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(approveArticles(["a1", "a2"])).rejects.toThrow("Not authenticated");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("no-ops on an empty selection", async () => {
    await approveArticles([]);
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("publishes every selected article in one updateMany call, without touching publishedAt", async () => {
    await approveArticles(["a1", "a2", "a3"]);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "a2", "a3"] } },
      data: expect.objectContaining({
        status: "published",
        reviewedBy: SESSION.userId,
        reviewedAt: expect.any(Date),
      }),
    });
    const [{ data }] = mockUpdateMany.mock.calls[0];
    expect(data).not.toHaveProperty("publishedAt");
  });

  it("never posts to Facebook, unlike single approve", async () => {
    await approveArticles(["a1", "a2"]);
    expect(mockPostArticleToFacebook).not.toHaveBeenCalled();
  });
});

describe("approveAllMatching", () => {
  it("throws and makes no changes when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(approveAllMatching({})).rejects.toThrow("Not authenticated");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("with no filters, approves every pending article in one call, without touching publishedAt", async () => {
    await approveAllMatching({});
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { status: "pending_review" },
      data: expect.objectContaining({
        status: "published",
        reviewedBy: SESSION.userId,
        reviewedAt: expect.any(Date),
      }),
    });
    const [{ data }] = mockUpdateMany.mock.calls[0];
    expect(data).not.toHaveProperty("publishedAt");
  });

  it("applies the source/category/title filters exactly like the queue view does", async () => {
    await approveAllMatching({ q: "arsenal", source: "BBC Sport", category: "football" });
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "pending_review",
          sourceName: "BBC Sport",
          category: "football",
          title: { contains: "arsenal", mode: "insensitive" },
        },
      })
    );
  });

  it("never posts to Facebook", async () => {
    await approveAllMatching({});
    expect(mockPostArticleToFacebook).not.toHaveBeenCalled();
  });
});

describe("rejectArticle", () => {
  it("throws and makes no changes when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(rejectArticle("a1")).rejects.toThrow("Not authenticated");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("marks the article rejected with no reason given", async () => {
    await rejectArticle("a1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: expect.objectContaining({ status: "rejected", profanityDetail: undefined }),
    });
  });

  it("records the reason when one is given", async () => {
    await rejectArticle("a1", "duplicate story");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: expect.objectContaining({ profanityDetail: "duplicate story" }),
    });
  });
});

describe("featureArticle (hero pick, cap-enforced)", () => {
  it("throws and makes no changes when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(featureArticle("a1")).rejects.toThrow("Not authenticated");
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("picks the article with no retirement when under the cap", async () => {
    mockFindMany.mockResolvedValue([
      { id: "x1", category: "football" },
      { id: "x2", category: "football" },
    ]); // 2 < HERO_CAP
    await featureArticle("new1");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "new1" },
      data: { featured: true, featuredAt: expect.any(Date) },
    });
  });

  it("retires the oldest pick when adding a new one at the cap, within the same section", async () => {
    const currentlyFeatured = Array.from({ length: HERO_CAP }, (_, i) => ({ id: `x${i}`, category: "football" }));
    mockFindMany.mockResolvedValue(currentlyFeatured); // already at HERO_CAP, oldest-first order
    await featureArticle("new1");

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "new1" }, select: { category: true } });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { featured: true }, orderBy: { featuredAt: "asc" } })
    );
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    // Oldest (first in the asc-ordered list) is retired first...
    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "x0" },
      data: { featured: false, featuredAt: null },
    });
    // ...then the new pick is added.
    expect(mockUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "new1" },
      data: { featured: true, featuredAt: expect.any(Date) },
    });
  });

  it("re-picking an article already at the cap just refreshes its timestamp, retiring nobody", async () => {
    const currentlyFeatured = Array.from({ length: HERO_CAP }, (_, i) => ({ id: `x${i}`, category: "football" }));
    mockFindMany.mockResolvedValue(currentlyFeatured);
    await featureArticle("x2"); // already one of the 5 currently featured

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "x2" },
      data: { featured: true, featuredAt: expect.any(Date) },
    });
  });

  // Real bug found and fixed (2026-09-10): the cap used to be checked
  // across ALL featured articles regardless of section, so 5 featured
  // cricket picks would silently block (and auto-retire!) a brand-new
  // football pick, even though the two sections' heroes never compete for
  // the same slide.
  it("a full cricket cap does NOT block or retire anything when featuring a football pick", async () => {
    mockFindUnique.mockResolvedValue({ category: "football" }); // the article being featured
    const currentlyFeatured = Array.from({ length: HERO_CAP }, (_, i) => ({ id: `c${i}`, category: "cricket" }));
    mockFindMany.mockResolvedValue(currentlyFeatured);

    await featureArticle("new-football-pick");

    expect(mockUpdate).toHaveBeenCalledTimes(1); // no retirement call at all
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "new-football-pick" },
      data: { featured: true, featuredAt: expect.any(Date) },
    });
  });

  it("groups a sub-category (football/world-cup) into its parent section for cap purposes", async () => {
    mockFindUnique.mockResolvedValue({ category: "football/world-cup" });
    const currentlyFeatured = Array.from({ length: HERO_CAP }, (_, i) => ({ id: `f${i}`, category: "football" }));
    mockFindMany.mockResolvedValue(currentlyFeatured);

    await featureArticle("new-world-cup-pick");

    // Same "football" section as the 5 already-featured plain-football
    // picks, so the cap applies and the oldest is retired.
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "f0" },
      data: { featured: false, featuredAt: null },
    });
  });

  it("revalidates the admin queue, the homepage manager, and the public homepage", async () => {
    await featureArticle("a1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/homepage");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("unfeatureArticle", () => {
  it("throws and makes no changes when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(unfeatureArticle("a1")).rejects.toThrow("Not authenticated");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("clears both the flag and its timestamp", async () => {
    await unfeatureArticle("a1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { featured: false, featuredAt: null },
    });
  });
});

describe("highlightArticle / unhighlightArticle", () => {
  it("highlightArticle throws and makes no changes when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(highlightArticle("a1")).rejects.toThrow("Not authenticated");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("highlightArticle sets the flag and a fresh timestamp", async () => {
    await highlightArticle("a1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { highlighted: true, highlightedAt: expect.any(Date) },
    });
  });

  it("unhighlightArticle clears both the flag and its timestamp", async () => {
    await unhighlightArticle("a1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { highlighted: false, highlightedAt: null },
    });
  });

  it("highlighting has no cap and never touches the hero findMany check", async () => {
    await highlightArticle("a1");
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("unflagArticle", () => {
  it("throws and makes no changes when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(unflagArticle("a1")).rejects.toThrow("Not authenticated");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sends the article back to pending_review", async () => {
    await unflagArticle("a1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { status: "pending_review" },
    });
  });
});

describe("combined workflows", () => {
  it("feature-then-approve leaves the article featured after publishing (approve never touches featured/highlighted)", async () => {
    // Simulates picking "Feature as hero" on a still-pending article, then
    // hitting Approve — the two actions touch disjoint fields, so the hero
    // pick made pre-approval should survive the publish untouched.
    await featureArticle("a1");
    await approveArticle("a1");

    const approveCall = mockUpdate.mock.calls.find(
      ([args]) => args.where.id === "a1" && args.data.status === "published"
    );
    expect(approveCall).toBeDefined();
    expect(approveCall![0].data).not.toHaveProperty("featured");
    expect(approveCall![0].data).not.toHaveProperty("highlighted");
  });

  it("bulk-approving a batch that includes an already-featured article does not touch its hero pick", async () => {
    await approveArticles(["a1", "a2", "a3"]);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ featured: expect.anything(), highlighted: expect.anything() }),
      })
    );
  });
});
