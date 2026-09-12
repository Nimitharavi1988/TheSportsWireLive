import { db } from "../db";
import { submitToIndexNow, articleUrl } from "../indexNow";
import { isMatchDataSource } from "../matchDataSources";
import { isHighlightWorthy } from "../highlightWorthy";
import { postArticleToFacebook } from "../social/facebook";

// Runs as a follow-up step right after runIngest.ts in the same GitHub
// Actions job — everything reaching "pending_review" has already passed
// every automated quality gate (profanity, spam-ID, reference-page,
// non-news-filler, stale-age — see qualityCheck.ts/playerNewsFeeds.ts),
// so this adds one more bar on top rather than replacing human review with
// nothing: real substantive body content AND a real (non-generic) image.
// Deliberately conservative thresholds — this is a genuine policy change
// (some content now ships without a human looking at it first), so it
// should only fire for articles that are unambiguously "as good as this
// pipeline gets," not merely "technically has some text."
const MIN_BODY_LENGTH = 150;
// Match-data preview/result templates ("Team A face Team B in MLB. First
// pitch is...") are inherently terse, factual, and already fully vetted (no
// extraction/scrape risk the way an arbitrary RSS body has) — the same
// 150-char bar meant to catch a thin/garbled scrape was instead blocking
// genuinely complete MLB previews sitting at 135-149 chars. Confirmed live:
// every one of 16 pending MLB items was stuck on this alone.
const MIN_MATCH_DATA_BODY_LENGTH = 80;

export function hasRealImage(article: { heroImageUrl: string | null; homeCrestUrl: string | null }): boolean {
  // A team crest pair is real by construction (never a stock photo).
  if (article.homeCrestUrl) return true;
  // A real photo — from the publisher's own RSS feed, a real player photo,
  // or a real match photo — as opposed to the generic category stock-photo
  // fallback (always served from Pexels; see stockImages.ts).
  if (article.heroImageUrl && !article.heroImageUrl.includes("pexels.com")) return true;
  return false;
}

export function isAutoApprovable(article: {
  body: string | null;
  heroImageUrl: string | null;
  homeCrestUrl: string | null;
  playerNewsSourced: boolean;
  sourceName: string;
}): boolean {
  if (!hasRealImage(article)) return false;
  // Player-news items (playerNewsFeeds.ts) used to be judged on image alone,
  // since a body was structurally impossible for them — Google News' own
  // RSS snippet for these is just the headline repeated. That's no longer
  // true: runIngest.ts now grounds their commentary call in the real
  // article page's text instead (articleTextExtractor.ts), so they're held
  // to the same real-body bar as everything else. An item where extraction
  // was blocked (robots.txt) or failed simply stays in pending_review for a
  // human to look at, same as any other budget/extraction miss.
  const minLength = isMatchDataSource(article.sourceName) ? MIN_MATCH_DATA_BODY_LENGTH : MIN_BODY_LENGTH;
  return Boolean(article.body && article.body.trim().length >= minLength);
}

export async function autoApproveValidArticles(): Promise<{ checked: number; approved: number }> {
  const candidates = await db.article.findMany({
    where: { status: "pending_review" },
    select: { id: true, slug: true, title: true, body: true, heroImageUrl: true, homeCrestUrl: true, playerNewsSourced: true, sourceName: true },
  });

  const toApprove = candidates.filter(isAutoApprovable);

  if (toApprove.length > 0) {
    await db.article.updateMany({
      where: { id: { in: toApprove.map((a) => a.id) } },
      data: {
        status: "published",
        // publishedAt deliberately NOT set — it already holds the article's
        // real-world publish date from ingestion. See approveArticle in
        // admin/actions.ts for the full reasoning (same bug this once was).
      },
    });

    // Best-effort, same isolation principle as the Facebook post below —
    // a failed ping here should never affect publishing.
    await submitToIndexNow(toApprove.map((a) => articleUrl(a.slug)));

    // Unlike the admin UI's bulk approveArticles/approveAllMatching (which
    // skip Facebook entirely — a human selecting dozens of items at once
    // isn't asking for dozens of Page posts), this IS the dominant approval
    // path now, so skipping it here meant most published content never
    // reached Facebook at all. Gated to isHighlightWorthy so a routine
    // scoreline/preview doesn't flood the Page — only genuinely notable
    // stories (event keywords, or a tracked star player), same bar as
    // "Transfers & Big News" on the homepage. Sequential + best-effort per
    // article: one failed/rate-limited post must never affect another.
    for (const article of toApprove) {
      if (!isHighlightWorthy(article.title)) continue;
      try {
        await postArticleToFacebook(article.id);
      } catch (err) {
        console.error("Facebook post failed for article", article.id, err);
      }
    }
  }

  return { checked: candidates.length, approved: toApprove.length };
}

if (require.main === module) {
  autoApproveValidArticles()
    .then(({ checked, approved }) => {
      console.log(`Auto-approve: ${approved} of ${checked} pending articles met the bar (real image + body >= ${MIN_BODY_LENGTH} chars, or >= ${MIN_MATCH_DATA_BODY_LENGTH} for match-data sources).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Auto-approve run failed:", err);
      process.exit(1);
    });
}
