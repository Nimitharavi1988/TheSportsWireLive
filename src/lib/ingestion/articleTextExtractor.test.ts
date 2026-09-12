import { describe, it, expect, vi, afterEach } from "vitest";
import { robotsAllows, extractArticleContent } from "./articleTextExtractor";

function textResponse(body: string, ok = true, contentType = "text/plain") {
  return { ok, status: ok ? 200 : 404, headers: { get: () => contentType }, text: async () => body };
}

function htmlResponse(body: string) {
  return { ok: true, status: 200, headers: { get: () => "text/html; charset=utf-8" }, text: async () => body };
}

const ARTICLE_HTML = `
<html><head><title>Real headline</title></head>
<body>
  <nav>Home | Scores | Login</nav>
  <article>
    <h1>Real headline</h1>
    <p>${"This is a real sentence about a cricket match with enough substance to survive Readability's content scoring. ".repeat(10)}</p>
  </article>
  <footer>Copyright 2026</footer>
</body></html>
`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("robotsAllows", () => {
  it("allows when the site has no robots.txt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => textResponse("", false)));
    expect(await robotsAllows("https://example.com/sport/story-1")).toBe(true);
  });

  it("disallows a path blocked for all user-agents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => textResponse("User-agent: *\nDisallow: /sport/\n"))
    );
    expect(await robotsAllows("https://example.com/sport/story-1")).toBe(false);
  });

  it("allows a path outside the disallowed prefix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => textResponse("User-agent: *\nDisallow: /premium/\n"))
    );
    expect(await robotsAllows("https://example.com/sport/story-1")).toBe(true);
  });

  it("lets a more specific Allow rule override a broader Disallow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => textResponse("User-agent: *\nDisallow: /sport/\nAllow: /sport/free/\n"))
    );
    expect(await robotsAllows("https://example.com/sport/free/story-1")).toBe(true);
    expect(await robotsAllows("https://example.com/sport/story-1")).toBe(false);
  });
});

describe("extractArticleContent", () => {
  it("extracts the main readable text from a real article page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("", false);
        return htmlResponse(ARTICLE_HTML);
      })
    );

    const result = await extractArticleContent("https://example.com/sport/story-1");
    expect(result).not.toBeNull();
    expect(result!.text).toContain("real sentence about a cricket match");
    expect(result!.text).not.toContain("Login");
  });

  it("extracts the publisher's og:image", async () => {
    const htmlWithImage = ARTICLE_HTML.replace(
      "<head><title>Real headline</title></head>",
      '<head><title>Real headline</title><meta property="og:image" content="https://example.com/photos/story-1.jpg"></head>'
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("", false);
        return htmlResponse(htmlWithImage);
      })
    );

    const result = await extractArticleContent("https://example.com/sport/story-1");
    expect(result?.imageUrl).toBe("https://example.com/photos/story-1.jpg");
  });

  it("falls back to twitter:image when there's no og:image", async () => {
    const htmlWithImage = ARTICLE_HTML.replace(
      "<head><title>Real headline</title></head>",
      '<head><title>Real headline</title><meta name="twitter:image" content="https://example.com/photos/tw.jpg"></head>'
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("", false);
        return htmlResponse(htmlWithImage);
      })
    );

    const result = await extractArticleContent("https://example.com/sport/story-1");
    expect(result?.imageUrl).toBe("https://example.com/photos/tw.jpg");
  });

  it("leaves imageUrl undefined when the page has no image meta tags", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("", false);
        return htmlResponse(ARTICLE_HTML);
      })
    );

    const result = await extractArticleContent("https://example.com/sport/story-1");
    expect(result?.imageUrl).toBeUndefined();
  });

  it("ignores a non-absolute og:image value", async () => {
    const htmlWithImage = ARTICLE_HTML.replace(
      "<head><title>Real headline</title></head>",
      '<head><title>Real headline</title><meta property="og:image" content="/relative/path.jpg"></head>'
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("", false);
        return htmlResponse(htmlWithImage);
      })
    );

    const result = await extractArticleContent("https://example.com/sport/story-1");
    expect(result?.imageUrl).toBeUndefined();
  });

  it("returns null when robots.txt disallows the path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("User-agent: *\nDisallow: /sport/\n");
        return htmlResponse(ARTICLE_HTML);
      })
    );

    expect(await extractArticleContent("https://example.com/sport/story-1")).toBeNull();
  });

  it("returns null when the page fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("", false);
        return textResponse("", false);
      })
    );

    expect(await extractArticleContent("https://example.com/sport/story-1")).toBeNull();
  });

  it("returns null for a non-HTML response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("", false);
        return { ok: true, status: 200, headers: { get: () => "application/pdf" }, text: async () => "" };
      })
    );

    expect(await extractArticleContent("https://example.com/sport/story-1.pdf")).toBeNull();
  });

  it("returns null when there's too little extractable content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return textResponse("", false);
        return htmlResponse("<html><body><p>Too short.</p></body></html>");
      })
    );

    expect(await extractArticleContent("https://example.com/sport/story-1")).toBeNull();
  });
});
