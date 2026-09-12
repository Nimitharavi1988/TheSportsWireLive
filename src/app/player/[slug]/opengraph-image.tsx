import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TRACKED_PLAYERS } from "@/lib/players";
import { fetchPersonPhoto, sportSearchHint } from "@/lib/ingestion/wikimediaImages";

// Player pages previously had no Open Graph image at all — a share on
// social media showed no preview image whatsoever. Same gradient-card
// pattern as article/[slug]/opengraph-image.tsx, using the player's real
// Wikimedia thumbnail (already fetched for the page itself) when available.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = TRACKED_PLAYERS.find((p) => p.slug === slug);
  const name = player?.name ?? "Sports Wire Live";
  const photo = player ? await fetchPersonPhoto(player.name, sportSearchHint(player.sport)) : null;

  const fontsDir = join(process.cwd(), "src/assets/fonts");
  const [bold, semibold] = await Promise.all([
    readFile(join(fontsDir, "Poppins-Bold.ttf")),
    readFile(join(fontsDir, "Poppins-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background: "linear-gradient(135deg, #1d6b3f, #123d24)",
          color: "white",
          fontFamily: "Poppins",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", opacity: 0.85 }}>
          Player News
        </div>

        {photo && (
          <img
            src={photo.url}
            width={180}
            height={180}
            style={{ borderRadius: "50%", objectFit: "cover", border: "6px solid rgba(255,255,255,0.25)" }}
          />
        )}

        <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.2, maxWidth: 1050 }}>
          {name}
        </div>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, opacity: 0.85 }}>Sports Wire Live</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Poppins", data: bold, weight: 700, style: "normal" },
        { name: "Poppins", data: semibold, weight: 600, style: "normal" },
      ],
    }
  );
}
