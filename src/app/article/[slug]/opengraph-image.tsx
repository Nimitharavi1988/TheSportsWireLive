import { ImageResponse } from "next/og";
import { db } from "@/db";
import { article as articleTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadOgFonts } from "@/lib/ogFonts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GRADIENTS: Record<string, [string, string]> = {
  cricket: ["#1d4e8f", "#0d2a52"],
  football: ["#1d6b3f", "#123d24"],
  "american-football": ["#6b3fa0", "#3a1f5c"],
};

function gradientFor(category: string): [string, string] {
  const key = Object.keys(GRADIENTS).find((k) => category.startsWith(k));
  return key ? GRADIENTS[key] : ["#555555", "#222222"];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const articleRows = await db.select().from(articleTable).where(eq(articleTable.slug, slug)).limit(1);
  const article = articleRows[0] ?? null;
  const title = article?.title ?? "Sports Wire Live";
  const category = article?.category ?? "";
  const [from, to] = gradientFor(category);

  const { bold, semibold } = await loadOgFonts();

  const hasCrests = Boolean(article?.homeCrestUrl && article?.awayCrestUrl);

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
          background: `linear-gradient(135deg, ${from}, ${to})`,
          color: "white",
          fontFamily: "Poppins",
        }}
      >
        {category && (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {category}
          </div>
        )}

        {hasCrests && (
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <img src={article!.homeCrestUrl!} width={96} height={96} />
            <div style={{ display: "flex", fontSize: 32, fontWeight: 600, opacity: 0.7 }}>vs</div>
            <img src={article!.awayCrestUrl!} width={96} height={96} />
          </div>
        )}

        <div style={{ display: "flex", fontSize: 54, fontWeight: 700, lineHeight: 1.25, maxWidth: 1050 }}>
          {title}
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
