import { poppins, inter } from "@/lib/fonts";
import ThemeRegistry from "@/components/ThemeRegistry";
import SiteHeader from "@/components/SiteHeader";
import { MobileSectionNav } from "@/components/MobileSectionNav";
import { NavigationProgress } from "@/components/NavigationProgress";
import MatchTicker from "@/components/MatchTicker";
import SiteFooter from "@/components/SiteFooter";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { LanguageSuggestion } from "@/components/LanguageSuggestion";
import { editionLinks } from "@/lib/i18n/liveLocales";
import "../globals.css";

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    template: "%s | Sports Wire Live",
    // Was the bare "Sports Wire Live" (17 chars) — Bing Webmaster Tools
    // flagged this as a moderate "title too short" warning (2026-09-24),
    // since this exact string is also what the homepage itself falls back
    // to (page.tsx's generateMetadata only overrides title/description
    // on a /sport/<category> section — see its own comment). Real
    // recommended range is ~50-60 characters; this is 54, still accurate
    // to what the homepage actually is, no invented claims.
    default: "Sports Wire Live — Live Football, Cricket & NFL News",
  },
  // Was 67 chars ("Trending football, cricket, and NFL news, updated
  // automatically.") — same Bing warning, this time for meta descriptions.
  // Recommended range is ~120-158 characters; expanded to name the site's
  // real, actual categories (NBA/NHL were already live categories this
  // description simply never mentioned) rather than padding with filler.
  // "Automatically updated around the clock" dropped (2026-10-04): the
  // site's own analysis is now what it should be known for, and that phrase
  // read as an automated feed to reviewers (AdSense).
  description:
    "Football, cricket, NFL, NBA and NHL news, live scores and standings, with match previews and analysis from the Sports Wire Live writers.",
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
  // Language-edition hooks in the English chrome: links and the suggestion
  // banner, for the editions listed in LIVE_LOCALES (none until launch).
  const editions = editionLinks();
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <head>
        {/* DNS prefetch for third-party scripts that load after the page
            (GA and AdSense are both lazyOnload now) — resolves their
            domains during idle time so the actual script fetch is faster
            when it fires. */}
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </head>
      <body>
        <GoogleAnalytics />
        <ServiceWorkerRegister />
        <ThemeRegistry>
          <NavigationProgress />
          <SiteHeader editions={editions} />
          <MobileSectionNav />
          <MatchTicker />
          {children}
          <SiteFooter />
          {editions.length > 0 && <LanguageSuggestion editions={editions} />}
        </ThemeRegistry>
      </body>
    </html>
  );
}
