import { categoryEmoji } from "@/lib/categoryDisplay";
import { db } from "@/db";
import { article as articleTable, vertical as verticalTable, socialPost as socialPostTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateSocialCaptions } from "@/lib/ingestion/commentary";
import { selectInstagramHashtags } from "./hashtagRepertoire";
import { resolvePageAccessToken } from "./facebook";



// Isolated social publisher, same shape as facebook.ts's postArticleToFacebook
// (per-vertical config with an env-var fallback, best-effort with its own
// SocialPost row, "not configured" treated as a no-op rather than an error).
// Instagram's Graph API is a two-step publish (create a media container,
// then publish it) and — unlike Facebook — has no text-only post type at
// all, so an article without a real image simply can't go to Instagram.
// Returns whether a real post actually happened — false for a silent no-op
// (already posted, or no real image to post), so a caller trying to
// guarantee "at least one post this run" can tell that apart from a real
// success and correctly move on to the next candidate article instead of
// mistaking a skip for a completed post.
export async function postArticleToInstagram(articleId: string): Promise<boolean> {
  // Idempotency guard — same reasoning as postArticleToFacebook's (see
  // facebook.ts): a repeated call for an already-posted article must be a
  // safe no-op, not a second real post.
  const [alreadyPosted] = await db.select({ id: socialPostTable.id }).from(socialPostTable)
    .where(and(eq(socialPostTable.articleId, articleId), eq(socialPostTable.platform, "instagram"), eq(socialPostTable.status, "posted")))
    .limit(1);
  if (alreadyPosted) return false;

  const [row] = await db.select({ article: articleTable, vertical: verticalTable })
    .from(articleTable)
    .innerJoin(verticalTable, eq(articleTable.verticalId, verticalTable.id))
    .where(eq(articleTable.id, articleId))
    .limit(1);
  if (!row) throw new Error(`Article not found: ${articleId}`);
  const article = { ...row.article, vertical: row.vertical };

  const igUserId = article.vertical.instagramBusinessAccountId ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const imageUrl = article.heroImageUrl;

  if (!igUserId || !pageId || !rawToken || !imageUrl) {
    return false;
  }

  // Same token-exchange requirement as Facebook posting (facebook.ts) — a
  // System User's own token isn't valid for the linked Page's assets
  // directly, IG included. Reuses the exact same exchange call.
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  const emoji = categoryEmoji(article.category);
  // Full caption upgrade (explicit request, 2026-09-22) — same
  // generateSocialCaptions call facebook.ts now uses (one Gemini call
  // writes both platform captions together), asked specifically for a
  // longer, hook-first caption with emoji visual breaks per Instagram's own
  // style, ending on a "link in bio" CTA rather than a spelled-out URL
  // (captions don't render URLs as links — see FollowUs.tsx's own comment
  // on the same limitation). Hashtags come from hashtagRepertoire.ts's
  // deterministic signal-based selection, not the model's judgment.
  // Best-effort: falls back to just the real title on any Gemini failure.
  const captions = article.body ? await generateSocialCaptions(article.title, article.body) : null;
  const captionBody = captions?.instagram ?? article.title;
  const hashtags = selectInstagramHashtags(article.title, article.category).join(" ");
  const caption = `${emoji} ${captionBody}\n\n${hashtags}`;

  const [socialPost] = await db.insert(socialPostTable)
    .values({ id: createId(), articleId, platform: "instagram", status: "queued" })
    .returning();

  try {
    const createRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.id) {
      throw new Error(createData?.error?.message ?? `Instagram media creation failed (${createRes.status})`);
    }

    // Instagram processes the container asynchronously (fetching/validating
    // the image at image_url) — publishing immediately after creation is a
    // race: confirmed live, a real container failed to publish with "Media
    // ID is not available" because it wasn't done processing yet. A polling
    // loop (up to 10 extra status_code GET calls per post) fixed that race
    // but caused a far worse regression: confirmed live, it multiplied our
    // Graph API call volume enough to hit Meta's own app-level rate limit
    // ("Application request limit reached") for 6+ straight hours, failing
    // nearly every post. A single fixed wait covers Instagram's typical
    // processing time without the extra calls — the rare container still
    // not ready after 8s just fails that one post (same acceptable
    // occasional-failure rate as before the polling loop existed), instead
    // of burning the whole app's rate limit checking on every single post.
    await new Promise((r) => setTimeout(r, 8000));

    const publishRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createData.id, access_token: accessToken }),
    });
    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
      throw new Error(publishData?.error?.message ?? `Instagram publish failed (${publishRes.status})`);
    }

    await db.update(socialPostTable)
      .set({ status: "posted", externalPostId: publishData.id, postedAt: new Date() })
      .where(eq(socialPostTable.id, socialPost.id));
    return true;
  } catch (err) {
    await db.update(socialPostTable)
      .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err) })
      .where(eq(socialPostTable.id, socialPost.id));
    throw err;
  }
}
