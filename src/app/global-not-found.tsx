import type { Metadata } from "next";
import "./globals.css";

// Unmatched URLs on either host. Needed because the app has two root layouts
// ((en) and (es)), so there is no single layout to compose a 404 from.
export const metadata: Metadata = { title: "404 — Sports Wire Live", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "80px 16px" }}>
        <h1 style={{ fontSize: 22 }}>Page not found · Página no encontrada</h1>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">Sports Wire Live</a>
      </body>
    </html>
  );
}
