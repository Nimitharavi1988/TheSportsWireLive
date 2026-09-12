/**
 * Fetches ONE specific, already-known article page (its URL always comes
 * from an RSS entry or a Google News search hit we already have — never
 * discovered by crawling) and extracts just its main readable text, for use
 * as PRIVATE grounding input to commentary.ts's Gemini rewrite. The
 * extracted text itself is never stored or rendered anywhere — only
 * Gemini's original rewritten prose becomes an article's `body`, same
 * discipline already applied to RSS `sourceSnippet` everywhere else in this
 * pipeline (see commentary.ts's header comment).
 *
 * Built specifically for two thin-content cases:
 *  - Player-news items (playerNewsFeeds.ts): Google News' RSS "snippet" for
 *    these is confirmed to be just the headline repeated verbatim — no real
 *    facts to ground a rewrite on, so these previously got no body at all.
 *  - Any RSS item whose own feed-provided snippet is too short to write a
 *    real piece from.
 *
 * Deliberately NOT a general crawler: one page per already-identified
 * article, capped by the same commentary budget as everything else,
 * robots.txt-checked first, and never attempting to bypass a paywall — a
 * blocked or unextractable page just means no grounding text, which the
 * caller treats the same as if this module didn't exist (fall back to
 * whatever thin snippet is available, or no body).
 */
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const USER_AGENT = "TheSportsWireLiveBot/1.0 (sports news aggregator; reads one already-linked article for summarization)";

// Enough facts to ground a several-sentence rewrite without pulling in a
// publisher's entire article — this module is a grounding source, not a
// mirror of the page.
const MAX_EXTRACT_CHARS = 3000;

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Minimal robots.txt check: applies the most specific matching Disallow/Allow
// rule (longest path match wins, standard robots.txt semantics) from either
// our own UA's group or the wildcard group. No robots.txt, or a failure to
// fetch/parse one, defaults to allowed — same "absence of a restriction
// means no restriction" reading every well-behaved crawler uses.
export async function robotsAllows(url: string): Promise<boolean> {
  let origin: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    pathname = parsed.pathname + parsed.search;
  } catch {
    return false;
  }

  const res = await fetchWithTimeout(`${origin}/robots.txt`, FETCH_TIMEOUT_MS);
  if (!res || !res.ok) return true;

  let text: string;
  try {
    text = await res.text();
  } catch {
    return true;
  }

  const ourUaGroup: { path: string; allow: boolean }[] = [];
  const wildcardGroup: { path: string; allow: boolean }[] = [];
  let currentGroups: { path: string; allow: boolean }[][] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [rawField, ...rest] = line.split(":");
    const field = rawField.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (field === "user-agent") {
      if (value === "*") currentGroups = [wildcardGroup];
      else if (value.toLowerCase().includes("sportswirelive") || value.toLowerCase().includes("thesportswirelivebot")) {
        currentGroups = [ourUaGroup];
      } else {
        currentGroups = [];
      }
    } else if (field === "disallow" && value) {
      for (const group of currentGroups) group.push({ path: value, allow: false });
    } else if (field === "allow" && value) {
      for (const group of currentGroups) group.push({ path: value, allow: true });
    }
  }

  const rules = ourUaGroup.length > 0 ? ourUaGroup : wildcardGroup;
  let bestMatch: { path: string; allow: boolean } | null = null;
  for (const rule of rules) {
    if (pathname.startsWith(rule.path) && (!bestMatch || rule.path.length > bestMatch.path.length)) {
      bestMatch = rule;
    }
  }
  return bestMatch ? bestMatch.allow : true;
}

export async function extractArticleText(url: string): Promise<string | null> {
  try {
    if (!(await robotsAllows(url))) return null;

    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res || !res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return null;

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent?.trim();
    if (!text || text.length < 100) return null;

    return text.slice(0, MAX_EXTRACT_CHARS);
  } catch (err) {
    console.error(`Article text extraction failed for "${url}":`, err);
    return null;
  }
}
