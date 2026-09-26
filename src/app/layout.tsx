import { Poppins, Inter } from "next/font/google";
import ThemeRegistry from "@/components/ThemeRegistry";
import SiteHeader from "@/components/SiteHeader";
import { MobileSectionNav } from "@/components/MobileSectionNav";
import MatchTicker from "@/components/MatchTicker";
import SiteFooter from "@/components/SiteFooter";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import GoogleAdSense from "@/components/GoogleAdSense";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    template: "%s | Sports Wire Live",
    // Was the bare "Sports Wire Live" (17 chars) — Bing Webmaster Tools
    // flagged this as a moderate "title too short" warning (2026-09-24),
    // since this exact string is also what the homepage itself falls back
    // to (page.tsx's generateMetadata only overrides title/description
    // when a ?category= param is present — see its own comment). Real
    // recommended range is ~50-60 characters; this is 54, still accurate
    // to what the homepage actually is, no invented claims.
    default: "Sports Wire Live — Live Football, Cricket & NFL News",
  },
  // Was 67 chars ("Trending football, cricket, and NFL news, updated
  // automatically.") — same Bing warning, this time for meta descriptions.
  // Recommended range is ~120-158 characters; expanded to name the site's
  // real, actual categories (NBA/NHL were already live categories this
  // description simply never mentioned) rather than padding with filler.
  description:
    "Breaking football, cricket, NFL, NBA, and NHL news, live scores, transfer updates, and match reports from Sports Wire Live — automatically updated around the clock.",
  openGraph: {
    siteName: "Sports Wire Live",
    type: "website",
  },
  // Lets feed readers and aggregators (Flipboard's Publisher account, etc.)
  // auto-discover the RSS feed instead of needing the URL typed in by hand.
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  twitter: {
    card: "summary_large_image",
  },
  // Without this, Google defaults to a smaller "standard" image preview
  // size in Search and Discover results — Discover specifically favors
  // large-image cards, so this directly affects Discover eligibility/reach,
  // not just cosmetic Search snippet size.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Bing Webmaster Tools + Meta (Facebook) domain-verification meta tags —
  // both HTML meta tag methods (no DNS change needed for either). The Meta
  // one is required for the Facebook Developer App to go Live and have its
  // posts actually distributed publicly (see the App Settings -> Brand
  // Safety domain-verification flow this was generated from, 2026-09-13).
  verification: {
    other: {
      "msvalidate.01": "85D948396988D4A498642D52FFF524DB",
      "facebook-domain-verification": "1wu4e0sq15ic02ovi486rzv199i54t",
    },
  },
};

// themeColor/colorScheme live on a separate `viewport` export (not
// `metadata`) since Next.js 14 — this is what tints the browser chrome/
// status bar to match the brand when the site is installed as a PWA.
export const viewport = {
  themeColor: "#1d6b3f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body>
        <GoogleAnalytics />
        <GoogleAdSense />
        <ServiceWorkerRegister />
        <ThemeRegistry>
          <SiteHeader />
          <MobileSectionNav />
          <MatchTicker />
          {children}
          <SiteFooter />
        </ThemeRegistry>
      </body>
    </html>
  );
}
