import type { MetadataRoute } from "next";

// Next.js's manifest.ts file convention — auto-served at /manifest.webmanifest
// with the <link rel="manifest"> tag injected automatically, same pattern as
// icon.tsx. This plus the service worker (public/sw.js, registered in
// layout.tsx) is what makes the site installable as a PWA on
// Android/desktop Chrome and, as of iOS 16.4+, iPhone Safari too.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sports Wire Live",
    short_name: "Sports Wire",
    description: "Trending football, cricket, and NFL news, updated automatically.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d6b3f",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
