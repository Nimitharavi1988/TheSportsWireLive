# Sports Wire Live: Enhancement Strategy

Drafted 2026-10-11. This is the planning view across all workstreams. `PLAN.md` stays the engineering log; this file decides what to do next and in what order. Items marked **[USER]** need the user's own action or approval. Nothing here is built unless marked "live".

## 1. Goals and rules

**Goals, in order:**
1. More returning visitors (repeat visits per person, not just first-time reach).
2. Get AdSense approved (reapply window 2026-10-27 to 11-03) and keep the site worth approving.
3. Grow reach per audience through video and per-sport social pages.

**Rules that apply to every item:**
- Branch first; merge to master only when asked (pushing master deploys).
- Simple, light UI; nothing dark or ornamented.
- Verify on production, not just localhost.
- Outward actions (posting, deleting, publishing, sending) need an explicit OK.
- Post only fresh stories (last hour, at most today) when posting by hand.
- No invented bylines; originals go under a named reviewer.
- Free-model text never goes out unreviewed where a paid review exists.

## 2. Where we are (baseline)

| Area | State |
|---|---|
| Traffic | About 1,800-1,900 tracked sessions a day (AppEvent counter). Most come from the Facebook in-app browser, which can't install a PWA or receive push. |
| Content | About 20,600 sitemap URLs, about 19,700 of them rewrites. Thin ones (under 300 words) are noindexed. About 32 original pieces published. Enrichment runs at 15 a day. |
| Engagement on site | Polls (admin-made, manual), Hype/Panic/Neutral reactions, follows (cookie), For You page, push (automated, 3 a day, sent to everyone). No public accounts, no comments. |
| Install funnel | Banner shown about 840-1,100 a day, 2 clicks, 1 install. In-app tip shown 50, clicked 0. The banner is not working for this audience. |
| Video | Instagram and Facebook reels automated. YouTube Shorts live since 2026-10-10 for English (channel @sportswirelivenews). |
| Social | Pages for Main, Cricket Live, Football, US Live, Fight Night, Greenfield, Spanish. Engagement bot is dry-run only. |
| Spanish edition | Live and indexable since 2026-10-03. |
| AdSense | Rejected once. Reapply 2026-10-27 to 11-03, after the checklist in section 6 is done. |

## 3. Pillar A: Returning users (the main new work)

Reuse what exists. The site already has polls, reactions, follows, the voter cookie and push.

**A1. Fix the privacy page. DONE on branch `feature/privacy-and-predictions` (not merged).**
The page now lists the real cookies (`swl_voter_id`, `swl_follows`, `swl_fav_sports`), browser storage, anonymous counters, push subscriptions and how polls and predictions are stored. It still says there are no accounts or comments; rewrite again before any login or comment feature ships.

**A2. Auto-generated match predictions. BUILT on branch `feature/privacy-and-predictions` (not merged, nothing created in production yet).**
- Before: a poll existed only when an admin created one (`admin/actions.ts`); production had 0 polls.
- Now: `predictionsRun.ts` (a new step in `live-refresh.yml`, every few minutes) opens "Who will win?" for big upcoming matches within 36 hours, up to 40 per run. Football gets a Draw option. Big = tier 1/2 competitions, no women's or youth fixtures, cricket needs a senior side. A dry run found 18 eligible matches (NFL, NBA, NHL, MLB, MLS, Liga MX, Serie A, Premier League).
- Picks close at kickoff (server-enforced in the vote route). After full time the resolver marks the poll right, wrong or void (cricket is read from the result line; an unclear result voids rather than guesses; matches that never finish are voided after 7 days). The widget shows 🏆 on the winner and "You called it!" or "Not this time".
- DB: additive columns `Poll.kind/resolvedOptionId/resolvedAt`, `PollOption.outcome` (migration `scripts/sql/2026-10-11-match-predictions.sql`, already applied to the live DB; rollback is in the file).
- Verified: 10 unit tests, resolution on a real finished match, vote and kickoff lock, widget in the browser, type check. The English article page only; Spanish article pages don't render the hub yet (strings are ready in both dictionaries).
- Next for A2: a "my record" line from the voter id (feeds the A4 badges), and cricket team-name matching for women's/abbreviated names.

**A3. Follow-targeted push.**
- `PushSubscription` has no link to follows, so everyone gets the same alert.
- Store each subscriber's follows (or a hash of them) at subscribe time and send match and story alerts only to followers of those teams.
- Add a locale column at the same time. This unblocks Spanish push.
- Keep the 3-a-day ceiling.
- Handoff finding: pushes currently fail with "VAPID keys not configured" about 16 times a day. Fix that first (add the keys or skip quietly), or A3 builds on a broken sender. **[USER]** supplies or confirms the VAPID keys.

**A4. Visit streaks and fan badges (no login). BUILT on branch `feature/fan-card` (not merged), English edition only.**
- Done: `FanVisit` table (one row per anonymous visitor per day, applied to the live DB, rollback in `scripts/sql/2026-10-11-fan-visit.sql`); `FanBeacon` counts a day after a real interaction, once per local day; `/fan-card` page (level, streak, best streak, days, prediction record, badges earned and still to earn); a header streak chip (shown from 2 days) and a footer link; privacy text updated.
- Badges: Rookie 1 day, Regular 7, Season Ticket 30, Hall of Famer 100; 3, 7 and 30 day streaks; First Prediction; Sharp Eye (5 correct).
- Measurement: anonymous daily counters `fan_new_visitor`, `fan_return_visit`, `prediction_vote`, `poll_vote`, `fan_chip_clicked`, `fan_card_opened`, `badge_<id>`; run `npx tsx --env-file=.env scripts/fanReport.ts [days]` for counters, D1/D7 return rates, days-active spread, prediction participation, repeat players and hit rate.
- Not done: Spanish edition (needs dictionary strings), the shareable card image (A5).
- Original design notes:
- Table `FanStats` keyed on the voter id: last visit day, distinct days, current streak, longest streak, top sport.
- One write per visitor per day, sent from the client after first real interaction (this also screens out most bots). No write per page view.
- Use `ON CONFLICT` upserts and `db.batch`, because the Neon HTTP driver has no transactions.
- Tiers: Rookie (1 day) → Regular (7) → Season Ticket (30) → Hall of Famer (100). Streaks of 3, 7 and 30 days. Sport tags such as Cricket Die-hard.
- Participation badges: First Prediction, Sharp Eye (5 correct picks).
- Show a small streak chip in the header, plus a "My fan card" page.
- Limits: a cleared cookie resets it. Badges give recognition only and never lock content.
- Spanish strings go through the dictionary.

**A4b. Fan feedback. BUILT on branch `feature/fan-card` (not merged), English edition only.**
- **Match rating:** 1 to 5 stars on a match page once it is final; shows average and count; a fan can change their rating. Table `MatchRating`.
- **Private site feedback:** `/feedback` page (footer link): thumbs up or down plus an optional note up to 300 characters, read in admin at `/admin/feedback` (mark handled). Never shown publicly. Table `SiteFeedback`.
- **Fan Voices:** "Fans say" on matches that have a prediction poll: first name, optional country, 8 to 150 words. Every take waits in `/admin/fan-voices` for Approve or Reject; only approved takes show. One take per fan per match. Table `FanVoice`.
- **Safeguards:** links, email addresses, phone numbers and the shared profanity list are rejected (`src/lib/profanity.ts`, extracted from the ingestion check); 3 notes and 3 takes per visitor per day; hidden honeypot field; crawlers ignored.
- **Measurement:** counters `match_rating`, `feedback_up`, `feedback_down`, `fan_voice_submitted`, `fan_voice_approved`; `scripts/fanReport.ts` now also prints ratings, feedback and Fan Voices sections.
- **Known limits:** the profanity list misses plurals ("bastards"), so the human review is the real gate. Fan Voices load in the browser, so Google does not index them yet; render them on the server later if they should count as page content for AdSense.

**A4c. Usage check and fixes (2026-10-13). BUILT on branch `feature/favourites-and-top-predictions` (not merged).**
- Finding: almost no interaction (1 prediction pick across 88 polls, 26 reactions lifetime, 0 ratings or feedback) and about 0.1% next-day return among counted fans. Favourites (follows, For You) had no measurement at all because they live only in a cookie.
- Favourites counters: `follow_added` (+ by kind), `follow_removed`, `follows_active` (sessions with at least one favourite), `for_you_strip_shown`, `for_you_strip_clicked`, `for_you_page_opened`.
- Card counters: `prediction_shown`, `rating_shown`, so pick and rating rates can be read against cards shown. `fanReport.ts` prints a Rates section.
- Prediction (before kickoff) and rating (after full time) now sit directly under the match header on match pages, instead of below the article and video strip. Reactions stay at the bottom.
- To read after about 3 days of data: pick rate (picks / cards shown), share of sessions with a favourite, strip click rate. Also compare Google Analytics "returning users" with the cookie-based return rate to see whether the visitor cookie survives in the Facebook in-app browser.

**A4d. One-tap favourites (2026-10-14). BUILT on branch `feature/for-you-one-tap-follow` (not merged).**
- Finding from the first day of favourites data: 1,643 strip views, 19 clicks, 26 For You opens, 0 follows. On a phone the For You page showed cricket series first and the Follow buttons ran off the card edge.
- Fix: one-tap chips (NFL, NBA, MLB, NHL, College football, Football, Cricket, plus teams and players) at the top of For You until five things are followed; four compact chips (NFL, NBA, Football, Cricket) on the invitation strip, which turns into "Following NFL. Your For You feed is ready." with a See my feed button; Follow buttons now fit inside the card on phones. Spanish edition has its own sports and teams.
- Counters: `quick_picks_shown`, `quick_pick_followed`; `fanReport.ts` Rates has a one-tap follow rate. Read after about 3 days: follows added, sessions with a favourite, and then whether followed fans come back more (compare fan return rate with and without a favourite).

**A4e. Article follow chips and top reactions (2026-10-14). BUILT on branch `feature/article-follow-and-reactions` (not merged).**
- Follow chips under the team, player and country tags on every article ("Follow  + Arsenal  + Everton", up to 4, same one-tap chips as For You), because visitors land on articles from Facebook and the club and player pages were the only place to follow them. All 263 tracked clubs and 279 tracked players resolve in the follow catalog.
- The 🔥🚨🥶 reactions row moved from the bottom of the article to just under the tags (it had 26 reactions ever). The poll stays lower down; match pages keep the prediction and rating card under the score.
- Counters: `article_follow_shown`, `article_follow_added`. After about 3 days compare article_follow_added with the For You chips (quick_pick_followed) and the reaction count per day with before (about 1 a day).

**A4f. Today's picks on the home page (2026-10-15). BUILT on branch `feature/todays-picks` (not merged).**
- A row under the hero on the main home page (English, no category): the 3 biggest open match predictions starting in the next 30 hours, with one-tap team buttons (a draw button for football). Picks use the normal vote route and close at kickoff; after a pick the buttons show the split (for example "✓ LA Clippers 100%") and the caption becomes "Come back after the games to see how you did." Endpoint `/api/picks` (per visitor, never cached); order is competition tier first, then soonest kickoff, one entry per matchup. Reason: the prediction card on match pages was shown 7 times in a day and a half.
- Counters: `picks_row_shown`, `picks_row_voted` (plus the existing `prediction_vote`); `fanReport.ts` prints a "Today's picks row" rate. After about 3 days compare with the match-page card (`prediction_shown` / picks), and check whether people who pick come back (fan card days) more than those who don't.
- Next idea: a "your last picks" line on the row for returning visitors ("You called 2 of 3") once picks resolve, and a link to the fan card.

**A5. Shareable fan card.** An image of the card for Facebook and WhatsApp. This is a growth loop for the Facebook audience. Build after A4.

**A6. Logins and comments (later, after A1-A4 show engagement).**
- Needs: public accounts (Google or Facebook login), a privacy rewrite, deletion on request.
- Comments only where there is demand: big-match reports, live blogs, opinion and analysis, plus articles that pass an engagement threshold (for example 20 or more votes and reactions). Roughly the top 10-20% of articles to start. Add an article-level `commentsEnabled` flag with an admin override.
- Moderation from day one: no links, rate limits, first-comment hold, report button, LLM screening (the installed `bad-words` package is too weak for sports abuse and for Spanish).
- Closed articles show a "Share your take" prompt instead of a dead box.
- Only moderated comments are indexable.

**A7. Fan Voices.** A reviewed submission form ("Share your take", 50-150 words). The best entries become a "Fans say" section on big-match pages, with name and country. This is original content, so it also helps AdSense.

**A8. Later, only if A1-A7 prove demand:** a dedicated match hub (match articles already exist and carry a match header, scores and status, so comments and fan voices attach to those), live chat (needs Cloudflare Durable Objects, has no SEO value, highest moderation load) and team fan pages.

**What to measure for Pillar A:** returning-visitor share, average days visited per person, prediction participation, push open rate by follow group, badge-chip impressions. Start collecting returning-visitor numbers in Google Analytics before A2 ships, so there is a before/after.

## 4. Pillar B: Video (Instagram, Facebook, YouTube Shorts)

Insight from the engagement bot: video and reels are the only formats breaking out on the Pages.

**Live:** one rendered MP4 per story goes to Instagram and Facebook reels, and English reels go to YouTube Shorts (from `postReel.ts`). A failure on YouTube never affects the other two.

**B1. YouTube pacing: merge the `youtube-pacing` branch. [USER: say go]**
- Minimum 2 hours between uploads and 8 a day, via `YOUTUBE_MIN_GAP_MINUTES` and `YOUTUBE_MAX_PER_DAY`.
- The old 6-a-day figure came from a stale quota cost. Uploads now cost about 100 units and use their own bucket.

**B2. Reliability.**
- Shorts and reels are skipped whenever the free LLM providers are exhausted, because reel copy fails first. Add a cheap fallback for the copy (a deterministic template from the headline) so a quota blip doesn't drop the video.
- Use `scripts/youtubeReport.ts` for the daily check. Add a line for Shorts counts to the Pipeline Health panel.

**B3. Quality of what we post.**
- Keep the freshness rule in code: refuse manual reels for stories older than about 24 hours unless the user overrides.
- Verify the reel hook is about the story's own match.
- Port the year/number guard from `feature/reel-local` into reel copy. It's the only part of that branch worth bringing over, along with the optional local MP4 copy.

**B4. YouTube-specific upgrades (deferred).**
- A subscribe end card (the current one says "Follow @sportswirelivenews" for Instagram).
- AI hook titles, playlists per sport.
- A pinned comment (needs the `youtube.force-ssl` re-authorisation).

**B5. Spanish video. Done (per the 2026-10-11 handoff).**
- The Spanish channel @sportswireliveES is live. Spanish Page reels upload there, and `spanishShorts.ts` picks the best Spanish story with a photo each run. Pacing is per channel (`YOUTUBE_MAX_PER_DAY=24`, 50-minute gap).
- Still open: Spanish supply is the limit (about 6 qualifying stories at a time); see the handoff's step 4 (24-hour age window, crest-based layout, more translations).
- Retry the skipped Spanish reels (Purdy, Málaga-Espanyol) and the Augsburg-Bayern Instagram reel if still wanted. **[USER]** Ask a Spanish reader to check the Stuttgart hook.

**B6. More Pages with video.** Football, US and Fight Pages have no reels yet. Add them once the YouTube and Instagram flow has run clean for a week.

**B7. Housekeeping. [USER OK needed]** Delete the two duplicate football Instagram reels (`17957817630015024`, `18009037898778723`). I never delete posts without approval.

## 5. Pillar C: Social Pages and the engagement bot

- Structure stays as planned: audience-grouped Pages, with more added only if traffic justifies it (Motorsport, Tennis, Golf; Rugby in August 2027; Olympic Sports in early 2028).
- **Engagement bot** (`sportswire-engagement`, branch `main`): ingest, insights and dry-run planner are green. **Next step:** review a day or two of planned comments **[USER]**, then turn on posting behind `ENGAGEMENT_LIVE=1`, starting with question and team-comparison replies only. Real human comments are very thin, so replies alone won't move reach much. Videos matter more.
- **Open investigation:** US Facebook viewers fell, and the cricket-crowding hypothesis is untested. Run the per-category daily counts (use `.env`, since the `.dev.vars` password is stale) and compare with Facebook post volume. This decides whether US sports need a bigger share of posting.
- **Deferred:** X/Twitter auto-posting needs the user's X developer account and API keys.

## 6. Pillar D: Content quality and AdSense (the gate for ad revenue)

Reapply 2026-10-27 to 11-03, not before. A second rejection gives no reason, so finish the checklist first.

**Checklist (from the 2026-10-04 review and 10-06 update):**
- Search Console shows the thin pages leaving the index. **[USER]** (needs a Google sign-in) to check clicks on `/article/` before and after noindex.
- 100-200 or more indexed substantial pages, from enrichment at about 15 a day plus writer pieces.
- Fix the three original pieces: Cavan Sullivan, Greenfield Stadium, the Kohli timeline.
- Photo credits on original stories.
- Written text on player and club profile pages (only Messi's profile is published; Ronaldo and Mbappé research failed).
- Google-certified consent banner for EEA/UK visitors. **[USER]** to approve it first.
- About page: stop calling the site only a "news aggregator", name the editors, give a working contact.
- Steady publishing for 2-3 weeks.

**Editorial pipeline, ongoing:**
- Next draft batch (`draftLocal.ts`), reviewing every draft and photo before recommending; the user approves under real writers' names.
- Free-model faithfulness check on routine write-ups. Record the writing model and source length on each article.
- Paid review pass for enriched reports.
- Send trending stories to the best models.
- Check the enrichment log for `enriched-short` junk, and the Greenfield claims.
- Fan Voices (A7) and moderated comments (A6) add original content, but only the moderated, reviewed parts count.

## 7. Pillar E: Spanish edition

Live since 2026-10-03.
- Spanish push (needs the locale column from A3).
- Native Spanish sources (Marca, AS, ESPN Deportes) for football depth.
- Spanish video (B5).
- A native-speaker review of about 20 articles, still recommended.
- Page-aware sitemap alternates on the English sitemap.
- Ads: needs an AdSense policy review for Spanish.
- More Spanish sports, using the opt-in approach in `LOCALES.categories`.
- Everything in Pillar A needs Spanish strings.

## 8. Pillar F: Mobile app and installs

- The install banner is not working (about 0.1% click rate). Most visitors are in the Facebook in-app browser, which cannot install or take push, and the in-app tip got 0 clicks.
- Decision still open: a Capacitor shell (scaffold in `mobile/`, uncommitted) is the recommended first step, since a store app is the only install path from the in-app browser. **[USER]** Apple and Google developer accounts and a Mac or cloud builder are needed before any build. Do not build until the user says go.
- Meanwhile, A3 and A4 give a reason to come back without an install.
- Try making the in-app tip more visible, or placing it after a prediction vote, before spending on the store app.

## 9. Pillar G: Growth backlog (needs the user)

- Guest posting and backlink outreach (I can draft pitches). HARO/Connectively for journalist quotes.
- The "freelanzsr" tool: needs clarification from the user.
- Google Business Profile: not recommended for a site with no location.
- X/Twitter: needs developer keys.

## 10. Roadmap

**This week (no accounts, low risk):**
1. A1 privacy page fix.
2. B1 merge the YouTube pacing branch (on the user's go), plus B2 copy fallback.
3. A2 auto predictions, built on a branch, tested on production data.
4. Coverage investigation (US vs cricket counts).
5. AdSense checklist items that need no decision (originals, photo credits, About page).

**Next 2 weeks:**
6. A3 follow-targeted push, with the locale column.
7. A4 streaks and badges, then A5 share card.
8. B5 Spanish channel and uploads once the user creates the channel.
9. Review a day of bot comments and decide on `ENGAGEMENT_LIVE=1`.
10. Consent banner (needs user approval), then reapply to AdSense in the window.

**After AdSense and a measurement review (4-6 weeks):**
11. A6 logins and moderated comments, only if engagement numbers justify it.
12. A7 Fan Voices.
13. Store app decision (section 8).
14. B6 reels for Football, US and Fight Pages.

**Only with proof of demand:** match pages, live chat, fan pages (A8).

## 11. Decisions needed from the user

1. Go on merging `youtube-pacing`?
2. Go on starting A1 (privacy) and A2 (auto predictions) on a branch?
3. OK to delete the two duplicate Instagram reels?
4. (Done) Spanish YouTube channel. New: provide or confirm the VAPID keys for push.
5. Approve the consent banner for the AdSense reapply.
6. Store app: wait for the funnel data, or go now?
7. Comments: agree to roughly the top 10-20% of articles at launch, not all articles?

## 12. Risks

- **Moderation load** (comments, fan voices): mitigated by first-comment hold, LLM screening and limiting where comments are on.
- **Free-model exhaustion** drops reels and Shorts: add the copy fallback (B2).
- **AdSense second rejection:** do not reapply before the checklist is done.
- **Privacy/compliance:** logins mean stored emails and deletion duties; the privacy policy must change first.
- **Empty features look dead:** launch comments and badges on big matches first.
- **Database write cost:** the Worker must not write on every page view; streak writes are once per visitor per day.
