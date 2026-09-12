import { ImageResponse } from "next/og";

// See icon-192/route.tsx — same brand mark, larger size for the manifest's
// maskable/high-res icon slot.
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
          fontSize: 280,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        S
      </div>
    ),
    { width: 512, height: 512 }
  );
}
