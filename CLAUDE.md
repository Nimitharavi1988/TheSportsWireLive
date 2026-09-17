# Instructions for Claude Code

## Token usage

Operate in minimal-token-usage mode by default, in every session on this project, until the user explicitly says usage has been topped up / this restriction is lifted:

- Keep responses short — result and next step, not a narration of process.
- Don't re-read files already read or just edited in this session; trust prior tool results.
- Batch related tool calls instead of exploratory back-and-forth reads.
- Skip optional verification passes (extra screenshots, redundant console/log checks) unless the change is genuinely risky or the user needs visual proof.
- Don't spawn subagents for work that can be done directly — a subagent re-derives context from scratch, which costs more tokens than doing it inline.
- Summarize diffs/file contents back to the user instead of pasting large blocks.

## Structured data (JSON-LD) policy

Applies to SportsEvent, NewsArticle, and any future structured data on article/[slug]/page.tsx or elsewhere:

- **Never fabricate a field.** Only include a schema.org property when we have real, accurate data for it. An omitted optional field is always correct; an invented one is not — this matches the site's core "no invented facts" editorial policy everywhere else.
- **Per-sport data reality** (as of 2026-09-15, verified live against each source):
  - `location`/venue: real for **cricket** (CricketData.org's `match.venue`), **NFL, NHL, the domestic football leagues** (Bundesliga/Serie A/Ligue 1/MLS/Indian Super League — all from ESPN's `site.api.espn.com` scoreboard API, which provides `venue.fullName`/`address`), and **ESPN Volleyball** (US college volleyball, same ESPN endpoint shape — added 2026-09-17 as a second volleyball source after the original one's API-Sports.io account was suspended; see `espnVolleyballData.ts`). **Not available** for football-data.org's own coverage (doesn't return a venue field on our API tier — confirmed via a live API call, not just docs) or the original **API-Volleyball** source (API-Sports.io's `/games` response has no venue field). Stored on `Article.venue`.
  - `image`: prefer `heroImageUrl`, fall back to `homeCrestUrl` — a crest-only match article still has a real image, just not a hero photo.
  - `organizer`: the competition/series name when known (`seriesLabel`), else the sport category label — always a real value, never invented. `organizer.url` points at our own category page.
  - `endDate`, `offers`, `performer`: no real data exists anywhere in this pipeline (we don't know match duration in advance, don't sell tickets, and don't track individual athlete lineups for match results) — leave these unset rather than estimate/invent.
- **Verify structured-data changes with Google's actual Rich Results Test** (`search.google.com/test/rich-results?url=<page>`) against a real live article before considering a fix done — don't just eyeball the JSON-LD output. A deploy can lag a minute or two behind a push; re-check after confirming the new version is actually live (e.g. via a quick `curl`).
- Google Search Console flags issues via email — check Search Console's own Events/Enhancements report periodically, and use "Validate Fix" after a real fix ships to prompt an earlier recrawl instead of waiting for the natural cycle.
