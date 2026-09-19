import type { ImageLoaderProps } from "next/image";

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
  const params = [`width=${width}`, `quality=${quality ?? 75}`, "format=auto"];
  return `/cdn-cgi/image/${params.join(",")}/${src}`;
}
