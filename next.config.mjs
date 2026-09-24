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
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
