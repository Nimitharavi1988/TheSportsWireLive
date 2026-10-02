import { poppins, inter } from "@/lib/fonts";
import ThemeRegistry from "@/components/ThemeRegistry";
import SiteHeader from "@/components/SiteHeader";
import { MobileSectionNav } from "@/components/MobileSectionNav";
import SiteFooter from "@/components/SiteFooter";
import { NavigationProgress } from "@/components/NavigationProgress";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { ES } from "@/lib/i18n/es";
import { LOCALES } from "@/lib/i18n/locales";
import "../globals.css";

// Root layout of the Spanish edition (served on es.sportswirelive.com via the
// middleware rewrite to /es, see lib/i18n/hostRouting.ts). It uses the SAME
// header, section row and footer components as the English site, driven by the
// Spanish dictionary — so the design is identical. A separate root layout
// (route group) rather than a branch inside the English one, so <html lang="es">
// is static and no existing page becomes dynamic.
const HOST = `https://${LOCALES.es.host}`;
const LOCALE = "es";

export const metadata = {
  metadataBase: new URL(HOST),
  title: { template: "%s | Sports Wire Live", default: ES.metaTitle },
  description: ES.metaDescription,
  openGraph: { siteName: "Sports Wire Live", type: "website", locale: ES.ogLocale },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export const viewport = { themeColor: "#1d6b3f" };

export default function SpanishRootLayout({ children }: { children: React.ReactNode }) {
  const otherSite = { href: process.env.SITE_URL ?? "https://sportswirelive.com", label: ES.otherSiteLabel };
  return (
    <html lang={ES.htmlLang} className={`${poppins.variable} ${inter.variable}`}>
      <body>
        <GoogleAnalytics />
        <ThemeRegistry>
          <NavigationProgress />
          <SiteHeader locale={LOCALE} otherSite={otherSite} />
          <MobileSectionNav locale={LOCALE} />
          {children}
          <SiteFooter locale={LOCALE} />
        </ThemeRegistry>
      </body>
    </html>
  );
}
