import { Poppins, Inter } from "next/font/google";
import ThemeRegistry from "@/components/ThemeRegistry";
import SiteHeader from "@/components/SiteHeader";
import MatchTicker from "@/components/MatchTicker";
import SiteFooter from "@/components/SiteFooter";
import GoogleAnalytics from "@/components/GoogleAnalytics";
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
    default: "Sports Wire Live",
  },
  description: "Trending football, cricket, and NFL news, updated automatically.",
  openGraph: {
    siteName: "Sports Wire Live",
    type: "website",
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
  // Bing Webmaster Tools site-ownership verification (HTML meta tag
  // method — chosen over the CNAME method since it needs no DNS change).
  verification: {
    other: {
      "msvalidate.01": "85D948396988D4A498642D52FFF524DB",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body>
        <GoogleAnalytics />
        <ThemeRegistry>
          <SiteHeader />
          <MatchTicker />
          {children}
          <SiteFooter />
        </ThemeRegistry>
      </body>
    </html>
  );
}
