import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// One-off live test route for the new Instagram poster format (see
// genInstaPoster.tsx, the local preview script this was promoted from) —
// Instagram's media-creation API needs a real public URL to fetch the
// image from, so this exists purely to give the manual test post
// (postInstagramPosterTest.ts) something to point image_url at. Not part
// of the per-article system yet — that's the follow-up "apply to direct
// and ingestion" step, once this one confirms the format actually works.
export async function GET() {
  const fontsDir = join(process.cwd(), "src/assets/fonts");
  const [bold, semibold] = await Promise.all([
    readFile(join(fontsDir, "Poppins-Bold.ttf")),
    readFile(join(fontsDir, "Poppins-SemiBold.ttf")),
  ]);

  const bgImageRes = await fetch(
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg/330px-Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg",
    { headers: { "User-Agent": "TheSportsWireLiveBot/1.0 (sports news aggregator)" } }
  );
  const bgImageBuf = Buffer.from(await bgImageRes.arrayBuffer());
  const bgImage = `data:image/jpeg;base64,${bgImageBuf.toString("base64")}`;

  const rows: [string, string][] = [
    ["Final score", "Man City 1–0 Man Utd"],
    ["Goal scorer", "Erling Haaland"],
    ["Controversy", "VAR error admitted post-match"],
    ["Red card", "Phil Foden (Man City)"],
    ["Utd reaction", '"An injustice" — Martínez & Carrick'],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: "Poppins",
          background: "#0a0e0a",
        }}
      >
        <img
          src={bgImage}
          width={1080}
          height={1350}
          style={{ position: "absolute", top: 0, left: 0, objectFit: "cover", filter: "grayscale(35%) brightness(0.55)" }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(10,14,10,0.55) 0%, rgba(10,14,10,0.15) 30%, rgba(10,14,10,0.35) 55%, rgba(10,14,10,0.97) 82%, #0a0e0a 100%)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", padding: "48px 56px 0 56px", position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 18px",
              borderRadius: 6,
              background: "linear-gradient(135deg, #2f8a5c, #17512f)",
            }}
          >
            <div style={{ display: "flex", color: "white", fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>
              SPORTS WIRE LIVE
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", padding: "0 56px", position: "relative" }}>
          <div
            style={{
              display: "flex",
              color: "#ff4d4d",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            ⚽ Manchester Derby
          </div>
          <div
            style={{
              display: "flex",
              color: "white",
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.08,
              textShadow: "0 4px 18px rgba(0,0,0,0.85)",
            }}
          >
            REF ADMITS THE ERROR. GOAL STILL STOOD.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "36px 56px 0 56px", position: "relative" }}>
          {rows.map(([label, value], i) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 0",
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <div style={{ display: "flex", color: "rgba(255,255,255,0.65)", fontSize: 32, fontWeight: 600 }}>{label}</div>
              <div style={{ display: "flex", color: "white", fontSize: 34, fontWeight: 700, textAlign: "right", maxWidth: 640 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "34px 56px 48px 56px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", color: "rgba(255,255,255,0.8)", fontSize: 30, fontWeight: 600 }}>
            👉 Full story — link in the comments below
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Poppins", data: bold, weight: 700, style: "normal" },
        { name: "Poppins", data: semibold, weight: 600, style: "normal" },
      ],
    }
  );
}
