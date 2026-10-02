import { poppins, inter } from "@/lib/fonts";
import ThemeRegistry from "@/components/ThemeRegistry";
import SiteHeaderEs from "@/components/es/SiteHeaderEs";
import SiteFooterEs from "@/components/es/SiteFooterEs";
import { NavigationProgress } from "@/components/NavigationProgress";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { ES } from "@/lib/i18n/es";
import { LOCALES } from "@/lib/i18n/locales";
import "../globals.css";

// Root layout of the Spanish site (served on es.sportswirelive.com via the
// middleware rewrite to /es, see lib/i18n/hostRouting.ts). A separate root
// layout (route group) rather than a branch inside the English one, so
// <html lang="es"> is static and no existing page becomes dynamic.
const HOST = `https://${LOCALES.es.host}`;

export const metadata = {
  metadataBase: new URL(HOST),
  title: { template: "%s | Sports Wire Live", default: ES.metaTitle },
  description: ES.metaDescription,
  openGraph: { siteName: "Sports Wire Live", type: "website", locale: "es_US" },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export const viewport = { themeColor: "#1d6b3f" };

export default function SpanishRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={ES.htmlLang} className={`${poppins.variable} ${inter.variable}`}>
      <body>
        <GoogleAnalytics />
        <ThemeRegistry>
          <NavigationProgress />
          <SiteHeaderEs />
          {children}
          <SiteFooterEs />
        </ThemeRegistry>
      </body>
    </html>
  );
}
