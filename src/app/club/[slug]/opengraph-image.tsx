import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { TRACKED_CLUBS } from "@/lib/clubs";
import { findClubCrest } from "@/lib/teamNames";

// Club pages previously had no Open Graph image at all. Same gradient-card
// pattern as article/[slug] and player/[slug]'s opengraph-image routes,
// using the club's own crest (pulled from its most recent match article,
// same lookup the club page itself uses) when available.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = TRACKED_CLUBS.find((c) => c.slug === slug);
  const name = club?.name ?? "Sports Wire Live";

  const articles = club
    ? await db.article.findMany({
        where: {
          status: "published",
          OR: club.searchTerms.map((term) => ({ title: { contains: term, mode: "insensitive" as const } })),
        },
        orderBy: { publishedAt: "desc" },
        take: 10,
        select: { summary: true, homeCrestUrl: true, awayCrestUrl: true },
      })
    : [];
  const crestUrl = club ? findClubCrest(club, articles) : null;

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
          Club News
        </div>

        {crestUrl && <img src={crestUrl} width={160} height={160} />}

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
