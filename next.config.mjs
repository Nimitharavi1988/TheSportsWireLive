import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
