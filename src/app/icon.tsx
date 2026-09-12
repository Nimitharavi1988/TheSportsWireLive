import { ImageResponse } from "next/og";

// The site had no favicon at all — browser tabs/bookmarks/history showed a
// generic blank-page icon, and Google Search actually renders a site's
// favicon next to its results now, so this affects real SERP appearance,
// not just the browser chrome. Next.js's icon.tsx file convention applies
// site-wide automatically (unlike opengraph-image.tsx, which is scoped per
// route segment), so this one file covers every page.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d6b3f",
          borderRadius: 6,
          color: "white",
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        S
      </div>
    ),
    size
  );
}
