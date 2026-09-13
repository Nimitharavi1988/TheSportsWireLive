import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Cloudflare Workers has no built-in image-resizing infra the way
    // Vercel does, and Cloudflare Images (the paid product that would add
    // one) isn't part of this project's free-tier stack — so real-time
    // resize/format-conversion isn't available here. `unoptimized: true`
    // still gets next/image's other real wins over a plain <img>: lazy
    // loading below the fold by default, enforced width/height (no layout
    // shift), and `priority` to eagerly preload the true LCP image.
    unoptimized: true,
    // Images come from dozens of publishers (RSS sources), Wikimedia,
    // Pexels, team-crest CDNs, etc. — an explicit per-domain allowlist here
    // would need a new entry every time a new RSS source is added. Safe to
    // stay wide open: unoptimized mode never proxies bytes through our own
    // server, it only ever renders the original <img src> directly.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
