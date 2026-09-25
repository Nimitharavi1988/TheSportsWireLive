import type { ImageLoaderProps } from "next/image";
import { upgradeImageUrl } from "./lib/imageQuality";

// Routes every next/image request through Cloudflare's on-the-fly Image
// Resizing (the "Images" product's transformation endpoint) instead of
// linking directly to the original third-party URL (Wikimedia, Pexels,
// ESPN, publisher CDNs, etc.) at full size with no caching — see
// next.config.mjs's `images` block for the reasoning. Cloudflare fetches the
// source once per unique transformation, resizes/re-encodes it (format=auto
// picks WebP/AVIF when the browser supports it), and caches the result at
// its edge, so repeat requests for the same width never hit the origin
// again. Requires "Resize images from any origin" enabled on the zone —
// without it, only images already served from this domain can be resized.
export default function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps): string {
  // /cdn-cgi/image only exists on the sportswirelive.com zone — on
  // *.workers.dev preview URLs and localhost it 404s, which left every
  // preview with broken images. Those builds get the original URL instead
  // (see next.config.mjs's NEXT_PUBLIC_IMAGE_RESIZING).
  // Small feed thumbnails (e.g. BBC's 240x135) become the full picture
  // first — see lib/imageQuality.ts.
  const source = upgradeImageUrl(src);
  if (process.env.NEXT_PUBLIC_IMAGE_RESIZING !== "1") return source;
  const params = [`width=${width}`, `quality=${quality ?? 75}`, "format=auto"];
  return `/cdn-cgi/image/${params.join(",")}/${source}`;
}
