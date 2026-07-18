/**
 * Renders an original, branded "scoreboard card" image for one article —
 * used as the image on Facebook posts (see src/lib/social/facebook.ts).
 *
 * Deliberately generated from our own data rather than pulled from a
 * third-party photo source, so there's no image-rights/copyright question.
 */
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

const GRADIENTS: Record<string, [string, string]> = {
  cricket: ["#1d4e8f", "#0d2a52"],
  "football/euros": ["#7a3fa0", "#3d1f52"],
  football: ["#1d6b3f", "#123d24"],
};

function gradientFor(category: string): [string, string] {
  if (GRADIENTS[category]) return GRADIENTS[category];
  if (category.startsWith("cricket")) return GRADIENTS.cricket;
  if (category.startsWith("football")) return GRADIENTS.football;
  return ["#555555", "#222222"];
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const article = await db.article.findUnique({ where: { slug: params.slug } });

  if (!article) {
    return new Response("Not found", { status: 404 });
  }

  const [from, to] = gradientFor(article.category);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(135deg, ${from}, ${to})`,
          padding: "60px 64px",
          fontFamily: "Georgia, serif",
          color: "white",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: -1, opacity: 0.85 }}>
          SPORTS NEWS
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              opacity: 0.8,
              marginBottom: 20,
            }}
          >
            {article.category}
          </div>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
            {article.title}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
