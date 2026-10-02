import { Poppins, Inter } from "next/font/google";

// Shared by both root layouts ((en) and (es)). display "optional" (was "swap"):
// the fonts are preloaded, so Chrome waits up to ~100ms for them and draws with
// them directly. With "swap" the first layout always drew with the Arial-based
// fallback first (Lighthouse traces, 2026-09-28: first paint 3.49s -> 3.16s).
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "optional",
});

// "latin" covers Spanish (á é í ó ú ñ ¿ ¡) — those are in the Latin subset.
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "optional",
});
