import { describe, it, expect } from "vitest";
import { localeForHost, routeForHost } from "./hostRouting";

describe("localeForHost", () => {
  it("maps the Spanish host and its dev alias", () => {
    expect(localeForHost("es.sportswirelive.com")).toBe("es");
    expect(localeForHost("es.localhost")).toBe("es");
    expect(localeForHost("sportswirelive.com")).toBeNull();
    expect(localeForHost("localhost")).toBeNull();
  });
});

describe("routeForHost", () => {
  it("rewrites supported Spanish-host paths into the internal /es tree", () => {
    expect(routeForHost("es.sportswirelive.com", "/")).toEqual({ kind: "rewrite", pathname: "/es" });
    expect(routeForHost("es.sportswirelive.com", "/article/foo-bar")).toEqual({ kind: "rewrite", pathname: "/es/article/foo-bar" });
    expect(routeForHost("es.localhost", "/sport/football")).toEqual({ kind: "rewrite", pathname: "/es/sport/football" });
  });
  it("sends untranslated pages to the English site", () => {
    expect(routeForHost("es.sportswirelive.com", "/scores")).toEqual({ kind: "redirect", host: "sportswirelive.com", pathname: "/scores" });
    expect(routeForHost("es.sportswirelive.com", "/admin")).toEqual({ kind: "redirect", host: "sportswirelive.com", pathname: "/admin" });
  });
  it("leaves shared assets and route handlers alone", () => {
    for (const p of ["/api/search/suggest", "/_next/static/x.js", "/media/a.jpg", "/icon-192", "/0a4732c758299384738c62c377da0ad7.txt"]) {
      expect(routeForHost("es.sportswirelive.com", p)).toEqual({ kind: "next" });
    }
  });
  it("serves its own robots, sitemaps and feed from the internal /es tree", () => {
    expect(routeForHost("es.sportswirelive.com", "/robots.txt")).toEqual({ kind: "rewrite", pathname: "/es/robots.txt" });
    expect(routeForHost("es.sportswirelive.com", "/sitemap.xml")).toEqual({ kind: "rewrite", pathname: "/es/sitemap.xml" });
    expect(routeForHost("es.sportswirelive.com", "/news-sitemap.xml")).toEqual({ kind: "rewrite", pathname: "/es/news-sitemap.xml" });
    expect(routeForHost("es.sportswirelive.com", "/feed.xml")).toEqual({ kind: "rewrite", pathname: "/es/feed.xml" });
  });
  it("blocks the internal /es tree on the main host", () => {
    expect(routeForHost("sportswirelive.com", "/es")).toEqual({ kind: "redirect", host: "es.sportswirelive.com", pathname: "/" });
    expect(routeForHost("sportswirelive.com", "/es/article/x")).toEqual({ kind: "redirect", host: "es.sportswirelive.com", pathname: "/article/x" });
    expect(routeForHost("sportswirelive.com", "/estadio")).toEqual({ kind: "next" });
  });
});
