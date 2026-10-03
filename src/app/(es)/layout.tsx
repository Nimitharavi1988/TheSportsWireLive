import { poppins, inter } from "@/lib/fonts";
import ThemeRegistry from "@/components/ThemeRegistry";
import SiteHeader from "@/components/SiteHeader";
import { MobileSectionNav } from "@/components/MobileSectionNav";
import SiteFooter from "@/components/SiteFooter";
import { NavigationProgress } from "@/components/NavigationProgress";
import MatchTicker from "@/components/MatchTicker";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { ES } from "@/lib/i18n/es";
import { LOCALES } from "@/lib/i18n/locales";
import { liveLocales } from "@/lib/i18n/liveLocales";
import "../globals.css";

// Root layout of the Spanish edition (served on es.sportswirelive.com via the
// middleware rewrite to /es, see lib/i18n/hostRouting.ts). It uses the SAME
// header, section row and footer components as the English site, driven by the
// Spanish dictionary — so the design is identical. A separate root layout
// (route group) rather than a branch inside the English one, so <html lang="es">
// is static and no existing page becomes dynamic.
const HOST = `https://${LOCALES.es.host}`;
const LOCALE = "es";

// Not indexable until the edition is launched (LIVE_LOCALES contains "es"):
// the Spanish host is reachable from day one, but translated pages should not
// reach search results before a human has reviewed them. Read per render, so
// adding "es" to LIVE_LOCALES lifts it within a revalidate cycle (no redeploy of
// code). Pages that set their own robots (search results, match score cards)
// keep noindex either way.
export function generateMetadata() {
  const live = liveLocales().some((l) => l.code === LOCALE);
  return {
    metadataBase: new URL(HOST),
    title: { template: "%s | Sports Wire Live", default: ES.metaTitle },
    description: ES.metaDescription,
    openGraph: { siteName: "Sports Wire Live", type: "website", locale: ES.ogLocale },
    twitter: { card: "summary_large_image" },
    // Meta domain verification, same value as the English site (Page links and previews).
    verification: { other: { "facebook-domain-verification": "1wu4e0sq15ic02ovi486rzv199i54t" } },
    robots: live
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
      : { index: false, follow: false },
  };
}

export const viewport = { themeColor: "#1d6b3f" };

export default function SpanishRootLayout({ children }: { children: React.ReactNode }) {
  const otherSite = { href: process.env.SITE_URL ?? "https://sportswirelive.com", label: ES.otherSiteLabel };
  return (
    <html lang={ES.htmlLang} className={`${poppins.variable} ${inter.variable}`}>
      <body>
        <GoogleAnalytics />
        <ThemeRegistry>
          <LocaleProvider locale={LOCALE}>
            <NavigationProgress />
            <SiteHeader locale={LOCALE} otherSite={otherSite} />
            <MobileSectionNav locale={LOCALE} />
            <MatchTicker locale={LOCALE} />
            {children}
            <SiteFooter locale={LOCALE} />
          </LocaleProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
