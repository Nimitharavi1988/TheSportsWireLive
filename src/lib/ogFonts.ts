/**
 * Real cause, confirmed live 2026-09-23 via Google Search Console reporting
 * 500 errors on every article/player opengraph-image route: all three
 * opengraph-image.tsx files (article/player/club) loaded the Poppins font
 * files with `fs.readFile(join(process.cwd(), "src/assets/fonts", ...))`.
 * That's a real, correct path in local dev (where process.cwd() is the repo
 * root and the source files genuinely sit there), but this site deploys to
 * Cloudflare Workers via OpenNext — the deployed runtime's file layout is
 * nothing like the source repo, so process.cwd() doesn't resolve to
 * anything matching that path in production, and every request 500'd.
 *
 * Fix: serve the same two font files as real static assets (public/fonts/,
 * already proven to work via Cloudflare's own ASSETS binding — see
 * wrangler.jsonc) and fetch them by URL instead of reading them off a
 * filesystem that doesn't exist the way it does locally. Centralized here
 * so the three opengraph-image routes share one implementation rather than
 * each re-deriving the same fetch.
 */
export async function loadOgFonts(): Promise<{ bold: ArrayBuffer; semibold: ArrayBuffer }> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const [bold, semibold] = await Promise.all([
    fetch(new URL("/fonts/Poppins-Bold.ttf", siteUrl)).then((r) => r.arrayBuffer()),
    fetch(new URL("/fonts/Poppins-SemiBold.ttf", siteUrl)).then((r) => r.arrayBuffer()),
  ]);
  return { bold, semibold };
}
