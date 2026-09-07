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
  title: "Sports News",
  description: "Trending football and cricket news, updated automatically.",
  openGraph: {
    siteName: "Sports News",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
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
