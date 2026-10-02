import { LOCALES } from "./locales";

// Host -> locale routing for the language subdomains (PLAN.md). Pure so the
// middleware's decisions are unit-tested.

export const MAIN_HOST = "sportswirelive.com";

// First path segments the Spanish site has its own pages for. Anything else on
// the Spanish host (scores, clubs, players...) is not translated yet, so it
// falls back to the English page rather than 404ing. Grow this list as pages
// get Spanish versions.
const SUPPORTED_PREFIXES = new Set(["article", "sport", "search"]);

// Served identically on every host (route handlers, assets, key files).
const PASS_THROUGH = /^\/(api|_next|media|social-posters|icon|icon-192|icon-512|manifest\.webmanifest|favicon\.ico|robots\.txt|sitemap\.xml|news-sitemap\.xml|feed\.xml|[a-f0-9]{32}\.txt)(\/|$|\.)/;

/** "es.sportswirelive.com" -> "es"; "es.localhost" (dev) -> "es"; main host -> null. */
export function localeForHost(hostname: string): string | null {
  const h = hostname.toLowerCase();
  for (const l of Object.values(LOCALES)) {
    if (h === l.host || h.startsWith(`${l.code}.localhost`) || h === `${l.code}.localhost`) return l.code;
  }
  return null;
}

export type HostAction =
  | { kind: "next" }
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; host: string; pathname: string };

export function routeForHost(hostname: string, pathname: string): HostAction {
  const locale = localeForHost(hostname);

  if (!locale) {
    // /es/... exists only as the internal route tree; on the main host it would
    // be a duplicate of the Spanish site, so send it there.
    for (const l of Object.values(LOCALES)) {
      if (pathname === `/${l.code}` || pathname.startsWith(`/${l.code}/`)) {
        return { kind: "redirect", host: l.host, pathname: pathname.slice(l.code.length + 1) || "/" };
      }
    }
    return { kind: "next" };
  }

  if (PASS_THROUGH.test(pathname + "/")) return { kind: "next" };
  const first = pathname.split("/")[1] ?? "";
  if (first === locale) return { kind: "next" }; // already internal (e.g. a rewritten request re-entering)
  if (first !== "" && !SUPPORTED_PREFIXES.has(first)) {
    return { kind: "redirect", host: MAIN_HOST, pathname };
  }
  return { kind: "rewrite", pathname: `/${locale}${pathname === "/" ? "" : pathname}` };
}
