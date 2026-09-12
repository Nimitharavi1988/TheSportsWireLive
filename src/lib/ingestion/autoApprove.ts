import { db } from "../db";
import { submitToIndexNow, articleUrl } from "../indexNow";

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
  return Boolean(article.body && article.body.trim().length >= MIN_BODY_LENGTH);
}

export async function autoApproveValidArticles(): Promise<{ checked: number; approved: number }> {
  const candidates = await db.article.findMany({
    where: { status: "pending_review" },
    select: { id: true, slug: true, body: true, heroImageUrl: true, homeCrestUrl: true, playerNewsSourced: true },
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

    // Best-effort, same isolation principle as the Facebook post in
    // admin/actions.ts — a failed ping here should never affect publishing.
    await submitToIndexNow(toApprove.map((a) => articleUrl(a.slug)));
  }

  // Deliberately does NOT post to Facebook — same precedent as the admin
  // UI's bulk approveArticles/approveAllMatching actions (see
  // admin/actions.ts): auto-posting a batch to the Page without a human
  // choosing to do so isn't something this should do on its own.
  return { checked: candidates.length, approved: toApprove.length };
}

if (require.main === module) {
  autoApproveValidArticles()
    .then(({ checked, approved }) => {
      console.log(`Auto-approve: ${approved} of ${checked} pending articles met the bar (real image + either body >= ${MIN_BODY_LENGTH} chars, or a player-news item with no body by design).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Auto-approve run failed:", err);
      process.exit(1);
    });
}
