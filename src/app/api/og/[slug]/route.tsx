/**
 * Renders an original, branded poster image for one article — used as the
 * image on Facebook posts (see src/lib/social/facebook.ts).
 *
 * Deliberately generated from our own data rather than pulled from a
 * third-party photo source, so there's no image-rights/copyright question.
 * Match-result articles ("Team A 2-1 Team B") get a scoreboard layout;
 * everything else gets a headline layout.
 *
 * Uses satori + resvg directly instead of next/og's ImageResponse — that
 * wrapper's default-font loader is broken on Windows in Next 14.2.35 (throws
 * ERR_INVALID_URL building a file:// path), and even after supplying a
 * custom font it still intermittently hit the same broken fallback-font
 * path. Calling satori/resvg ourselves avoids that code entirely.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";

const fontRegular = readFileSync("C:\\Windows\\Fonts\\georgia.ttf");
const fontBold = readFileSync("C:\\Windows\\Fonts\\georgiab.ttf");

const BRAND = "THE SPORTS WIRE LIVE";

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

function parseScoreTitle(title: string) {
  const match = title.match(/^(.+?)\s(\d+)-(\d+)\s(.+)$/);
  if (!match) return null;
  const [, home, homeScore, awayScore, away] = match;
  return { home, homeScore, awayScore, away };
}

function TopBar({ category }: { category: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 3, opacity: 0.9 }}>
        {BRAND}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: 0.85,
          border: "2px solid rgba(255,255,255,0.45)",
          borderRadius: 999,
          padding: "6px 20px",
        }}
      >
        {category}
      </div>
    </div>
  );
}

function Backdrop({ from, to }: { from: string; to: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 420,
          height: 420,
          borderRadius: 420,
          background: "rgba(255,255,255,0.06)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -160,
          left: -80,
          width: 360,
          height: 360,
          borderRadius: 360,
          background: "rgba(0,0,0,0.12)",
          display: "flex",
        }}
      />
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const article = await db.article.findUnique({ where: { slug: params.slug } });

  if (!article) {
    return new Response("Not found", { status: 404 });
  }

  const [from, to] = gradientFor(article.category);
  const score = parseScoreTitle(article.title);

  const content = score ? (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 56px",
        fontFamily: "Georgia",
        color: "white",
      }}
    >
      <Backdrop from={from} to={to} />
      <TopBar category={article.category} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 44 }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center" }}>
          {article.homeCrestUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.homeCrestUrl} width={100} height={100} style={{ marginBottom: 18 }} />
          )}
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
            {score.home}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            background: "rgba(255,255,255,0.14)",
            borderRadius: 24,
            padding: "18px 36px",
          }}
        >
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700 }}>{score.homeScore}</div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, opacity: 0.6 }}>–</div>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700 }}>{score.awayScore}</div>
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center" }}>
          {article.awayCrestUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.awayCrestUrl} width={100} height={100} style={{ marginBottom: 18 }} />
          )}
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
            {score.away}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", width: 80, height: 5, borderRadius: 3, background: "white", opacity: 0.85, marginBottom: 16 }} />
        <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 1, opacity: 0.85 }}>
          FULL TIME
        </div>
      </div>
    </div>
  ) : (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 56px",
        fontFamily: "Georgia",
        color: "white",
      }}
    >
      <Backdrop from={from} to={to} />
      <TopBar category={article.category} />
      {article.homeCrestUrl && article.awayCrestUrl && (
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.homeCrestUrl} width={64} height={64} style={{}} />
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, opacity: 0.65 }}>VS</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.awayCrestUrl} width={64} height={64} style={{}} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", width: 90, height: 6, borderRadius: 3, background: "white", opacity: 0.9, marginBottom: 24 }} />
        <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.15 }}>{article.title}</div>
      </div>
    </div>
  );

  const svg = await satori(content, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Georgia", data: fontRegular, weight: 400, style: "normal" },
      { name: "Georgia", data: fontBold, weight: 700, style: "normal" },
    ],
  });

  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();

  return new Response(png, { headers: { "content-type": "image/png" } });
}
