import { db } from "@/lib/db";
import { displaySummary } from "@/lib/articleSummary";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { TRACKED_PLAYERS } from "@/lib/players";

// A sport emoji at the start of the post text is a small, low-risk
// engagement lever on Facebook (unlike extra hashtags, which hurt reach —
// see below, this has no such downside since it's not a discoverability
// mechanism, just visual attention in the feed).
const CATEGORY_EMOJI: Record<string, string> = {
  cricket: "🏏",
  football: "⚽",
  "american-football": "🏈",
  basketball: "🏀",
  baseball: "⚾",
  rugby: "🏉",
  athletics: "🏃",
  hockey: "🏒",
  volleyball: "🏐",
  "formula-1": "🏎️",
};

function emojiFor(category: string): string {
  return CATEGORY_EMOJI[category] ?? "🏆";
}

// International team names/codes as they commonly appear in headlines —
// used only to build a series-specific hashtag ("#INDvAFG"), not for flag
// display (see cricketCountries.ts for why Afghanistan is excluded there),
// so there's no "wrong flag" risk in including it here.
const TEAM_TO_CODE: Record<string, string> = {};
for (const [name, code] of [
  ["India", "IND"], ["Australia", "AUS"], ["England", "ENG"], ["Pakistan", "PAK"],
  ["South Africa", "SA"], ["New Zealand", "NZ"], ["Sri Lanka", "SL"], ["Bangladesh", "BAN"],
  ["Afghanistan", "AFG"], ["Zimbabwe", "ZIM"], ["Ireland", "IRE"], ["Scotland", "SCO"],
  ["Netherlands", "NED"], ["Nepal", "NEP"],
] as const) {
  TEAM_TO_CODE[name.toLowerCase()] = code;
  TEAM_TO_CODE[code.toLowerCase()] = code;
}

// Matches "IND vs AFG LIVE Score, ..." / "India vs Afghanistan, 1st T20I" —
// same shape as liveCricket.ts's extractInternationalPair, kept separate
// here since this only needs the resulting hashtag, not team display names.
function seriesHashtag(title: string): string | null {
  const m = title.match(/^\s*([A-Za-z .]{2,20}?)\s+v(?:s\.?)?\s+([A-Za-z .]{2,20}?)(?:\s*[,:]|\s+LIVE\b|\s+Live\b|$)/i);
  if (!m) return null;
  const home = TEAM_TO_CODE[m[1].trim().toLowerCase()];
  const away = TEAM_TO_CODE[m[2].trim().toLowerCase()];
  if (!home || !away || home === away) return null;
  return `#${home}v${away}`;
}

// 2-3 hashtags reads as normal on Facebook; more than that measurably hurts
// reach on FB specifically (unlike Instagram/X, where stacking many is
// normal) — so this is deliberately capped, not "more tags = more reach."
// A series-specific tag (e.g. #INDvAFG) replaces the generic category tag
// when the headline is clearly about a specific international matchup —
// more discoverable without adding to the total count. Brand tag always
// included; a third, more specific tag only when a tracked star player is
// actually named in the headline.
function hashtagsFor(title: string, category: string): string {
  const categoryTag = categoryChipStyle(category).label.replace(/[^a-zA-Z0-9]/g, "");
  const primaryTag = seriesHashtag(title) ?? `#${categoryTag}`;
  const tags = [primaryTag, "#SportsWireLive"];

  const lower = title.toLowerCase();
  const player = TRACKED_PLAYERS.find((p) => p.searchTerms.some((term) => lower.includes(term.toLowerCase())));
  if (player) tags.push(`#${player.name.replace(/[^a-zA-Z0-9]/g, "")}`);

  return tags.join(" ");
}

// A Business System User's own token (what FACEBOOK_PAGE_ACCESS_TOKEN
// actually is, per the Meta setup this uses) is NOT directly valid for
// posting to a Page's /feed — confirmed live: every real post attempt
// failed with "(#200) ... requires ... as an admin with sufficient
// administrative permission" using that token as-is, even though the
// System User genuinely has pages_manage_posts/pages_read_engagement
// assigned. The fix is a one-call exchange: GET /{page-id}?fields=
// access_token with the System User token returns the actual Page-scoped
// token, which posting requires. Confirmed live: the exact same token that
// failed on /feed succeeded immediately once exchanged this way. Falls
// back to the original token if the exchange call itself fails, in case a
// genuine Page token was configured directly (no exchange needed then).
export async function resolvePageAccessToken(pageId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}?fields=access_token&access_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return token;
    const data = await res.json();
    return typeof data?.access_token === "string" ? data.access_token : token;
  } catch {
    return token;
  }
}

// Isolated social publisher: posts an approved article to the Facebook Page
// configured for its vertical (each product/vertical can post to its own
// Page). Falls back to the global env vars when a vertical has no Page of
// its own configured yet, so single-vertical setups keep working unchanged.
// A missing token/page id is treated as "not configured" rather than an
// error, since Facebook posting is optional (see README).
export async function postArticleToFacebook(articleId: string) {
  // Idempotency guard: confirmed live that repeated calls for the same
  // article (a manual admin re-click before the page re-rendered the
  // "already posted" state, or any future automated retry) were creating
  // multiple real Page posts for one story — 4 duplicate posts of the same
  // article within 16 seconds, observed directly in SocialPost rows.
  // Checking for an existing "posted" row makes every caller safe to retry.
  const alreadyPosted = await db.socialPost.findFirst({
    where: { articleId, platform: "facebook", status: "posted" },
  });
  if (alreadyPosted) return;

  const article = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { vertical: true },
  });

  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const accessToken =
    article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    return;
  }

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const link = `${siteUrl}/article/${article.slug}`;
  // The link itself is passed as its own `link` field, not pasted into the
  // message text — Facebook auto-generates a proper preview card (image,
  // title, domain) from it, which gets meaningfully more reach than a raw
  // URL sitting in the post body. That card's thumbnail comes from the
  // article page's own og:image (generateMetadata in article/[slug]/
  // page.tsx), so it only works correctly now that SITE_URL is set right
  // (see the earlier production fix — before that it pointed at localhost).
  const message = `${emojiFor(article.category)} ${article.title}\n\n${displaySummary(article, 400)}\n\n${hashtagsFor(article.title, article.category)}`;

  const socialPost = await db.socialPost.create({
    data: { articleId, platform: "facebook", status: "queued" },
  });

  try {
    const postToken = await resolvePageAccessToken(pageId, accessToken);
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, link, access_token: postToken }),
      }
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message ?? `Facebook API error (${res.status})`);
    }

    await db.socialPost.update({
      where: { id: socialPost.id },
      data: { status: "posted", externalPostId: data.id, postedAt: new Date() },
    });
  } catch (err) {
    await db.socialPost.update({
      where: { id: socialPost.id },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
