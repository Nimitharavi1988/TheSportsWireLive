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
    for (const p of ["/api/search/suggest", "/_next/static/x.js", "/media/a.jpg", "/robots.txt", "/icon-192"]) {
      expect(routeForHost("es.sportswirelive.com", p)).toEqual({ kind: "next" });
    }
  });
  it("blocks the internal /es tree on the main host", () => {
    expect(routeForHost("sportswirelive.com", "/es")).toEqual({ kind: "redirect", host: "es.sportswirelive.com", pathname: "/" });
    expect(routeForHost("sportswirelive.com", "/es/article/x")).toEqual({ kind: "redirect", host: "es.sportswirelive.com", pathname: "/article/x" });
    expect(routeForHost("sportswirelive.com", "/estadio")).toEqual({ kind: "next" });
  });
});
