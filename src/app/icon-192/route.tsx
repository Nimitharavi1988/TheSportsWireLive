import { ImageResponse } from "next/og";

// Same brand mark as icon.tsx (the favicon), rendered at PWA-manifest sizes
// via a route handler instead — the icon.tsx file convention is fixed to
// one favicon-sized output, so a dedicated route is needed for each size
// the manifest (manifest.ts) references.
export async function GET() {
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
          color: "white",
          fontSize: 104,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        S
      </div>
    ),
    { width: 192, height: 192 }
  );
}
