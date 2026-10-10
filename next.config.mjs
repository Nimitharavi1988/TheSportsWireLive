import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Cloudflare Image Resizing (/cdn-cgi/image, see src/imageLoader.ts) only
// works on the production zone, not on *.workers.dev preview URLs or
// localhost. Cloudflare Workers Builds sets WORKERS_CI_BRANCH, so only
// master (the production branch) builds with resizing on; other branches'
// preview builds and `next dev` use the original image URLs. A local
// `next build` (e.g. a manual `npm run deploy`) keeps resizing on.
// IMAGE_RESIZING=1/0 overrides either way.
const ciBranch = process.env.WORKERS_CI_BRANCH;
const useImageResizing = process.env.IMAGE_RESIZING
  ? process.env.IMAGE_RESIZING === "1"
  : ciBranch
    ? ciBranch === "master"
    : process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Two root layouts ((en), (es)) -> a standalone 404 for unmatched URLs.
  experimental: { globalNotFound: true },
  env: {
    NEXT_PUBLIC_IMAGE_RESIZING: useImageResizing ? "1" : "0",
  },
  images: {
    // Routes every image through Cloudflare's on-the-fly Image Resizing
    // (see src/imageLoader.ts) instead of linking directly to the original
    // third-party URL at full size with no caching — real resize/format
    // conversion (WebP/AVIF) and edge caching now happen on Cloudflare's
    // side, no origin server involved.
    loader: "custom",
    loaderFile: "./src/imageLoader.ts",
    // Images come from dozens of publishers (RSS sources), Wikimedia,
    // Pexels, team-crest CDNs, etc. — an explicit per-domain allowlist here
    // would need a new entry every time a new RSS source is added. Safe to
    // stay wide open: the custom loader only ever produces a same-origin
    // /cdn-cgi/image/... URL: Cloudflare (not our own server) is what
    // actually fetches the remote source.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // Every responsive image lists each of these widths in its srcset, in
    // the HTML. Next's defaults (16 widths, up to 3840px) made the image
    // lists 143 KB of the homepage's 544 KB (2026-09-27); nothing here is
    // shown wider than 960px, so 1920 covers it at 2x.
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
  },
  // Moving the pages into the (en) route group (2026-10) changed their generated Open Graph
  // image address from /x/<slug>/opengraph-image to /x/<slug>/opengraph-image-<suffix>, where
  // the suffix is Next's hash of the route ("/(en)/club/[slug]" -> 1pdc02, from
  // djb2Hash(parent path).toString(36).slice(0, 6)). Google had indexed the old address and now
  // gets a 404, so the old ones are redirected to the new. The suffix depends only on the
  // route's path, so it does not change between builds.
  async redirects() {
    return [
      { source: "/club/:slug/opengraph-image", destination: "/club/:slug/opengraph-image-1pdc02", permanent: true },
      { source: "/player/:slug/opengraph-image", destination: "/player/:slug/opengraph-image-4b061i", permanent: true },
      { source: "/article/:slug/opengraph-image", destination: "/article/:slug/opengraph-image-m91vm5", permanent: true },
    ];
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
