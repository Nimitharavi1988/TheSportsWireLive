import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PosterContent } from "@/lib/ingestion/commentary";

// Renders the grungy/high-contrast Instagram poster (bold hook + quick-read
// fact table over a darkened real photo) to a PNG buffer. Only ever run
// from a plain Node context (the GitHub Actions poster-post job) — next/og's
// ImageResponse (Satori + WASM) is a confirmed bad fit for Cloudflare
// Workers, so this must never be imported from anything the deployed app
// (a route/page) actually renders. See postInstagramPosterJob.ts.
export async function renderInstagramPoster(params: {
  content: PosterContent;
  heroImageUrl: string;
}): Promise<Buffer> {
  const fontsDir = join(process.cwd(), "src/assets/fonts");
  const [bold, semibold] = await Promise.all([
    readFile(join(fontsDir, "Poppins-Bold.ttf")),
    readFile(join(fontsDir, "Poppins-SemiBold.ttf")),
  ]);

  // Inlined as a data URI — satori's own image loader can't reliably
  // resolve a remote URL directly (confirmed live: "Unsupported image
  // type" against a Wikimedia thumbnail URL it fetched itself).
  const bgImageRes = await fetch(params.heroImageUrl, {
    headers: { "User-Agent": "TheSportsWireLiveBot/1.0 (sports news aggregator)" },
  });
  const bgImageBuf = Buffer.from(await bgImageRes.arrayBuffer());
  const contentType = bgImageRes.headers.get("content-type") ?? "image/jpeg";
  const bgImage = `data:${contentType};base64,${bgImageBuf.toString("base64")}`;

  const { eyebrow, hook, rows } = params.content;

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", fontFamily: "Poppins", background: "#0a0e0a" }}>
        <img src={bgImage} width={1080} height={1350} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover", filter: "grayscale(35%) brightness(0.55)" }} />
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
          <div style={{ display: "flex", alignItems: "center", padding: "8px 18px", borderRadius: 6, background: "linear-gradient(135deg, #2f8a5c, #17512f)" }}>
            <div style={{ display: "flex", color: "white", fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>SPORTS WIRE LIVE</div>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", padding: "0 56px", position: "relative" }}>
          <div style={{ display: "flex", color: "#ff4d4d", fontSize: 32, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
            {eyebrow}
          </div>
          <div style={{ display: "flex", color: "white", fontSize: 72, fontWeight: 700, lineHeight: 1.1, textShadow: "0 4px 18px rgba(0,0,0,0.85)" }}>
            {hook.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "36px 56px 0 56px", position: "relative" }}>
          {rows.map((row, i) => (
            <div
              key={row.label + i}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.14)" }}
            >
              <div style={{ display: "flex", color: "rgba(255,255,255,0.65)", fontSize: 32, fontWeight: 600 }}>{row.label}</div>
              <div style={{ display: "flex", color: "white", fontSize: 34, fontWeight: 700, textAlign: "right", maxWidth: 640 }}>{row.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "34px 56px 48px 56px", position: "relative" }}>
          <div style={{ display: "flex", color: "rgba(255,255,255,0.8)", fontSize: 30, fontWeight: 600 }}>👉 Full breakdown on Sports Wire Live</div>
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

  return Buffer.from(await image.arrayBuffer());
}
