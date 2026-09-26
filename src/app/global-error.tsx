"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

// Last-resort error page for a crash in the root layout itself (error.tsx
// covers everything below it). Replaces the whole document, so no theme or
// MUI here — plain markup only.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "80px 16px" }}>
        <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
        <p style={{ color: "#555" }}>This page hit an unexpected error.</p>
        <button onClick={() => reset()} style={{ padding: "8px 16px", marginRight: 8 }}>Try again</button>
        {/* A full page load on purpose: the app itself just crashed. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">Back to Sports Wire Live</a>
        <p style={{ color: "#999", fontSize: 12, wordBreak: "break-word" }}>{error.digest ? `Ref ${error.digest}` : error.message.slice(0, 160)}</p>
      </body>
    </html>
  );
}
