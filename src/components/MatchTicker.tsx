import { db } from "@/lib/db";
import Link from "next/link";
import Box from "@mui/material/Box";

// Titles for match articles already follow a fixed, parseable shape (see
// footballData.ts): "{home} {homeScore}-{awayScore} {away}" once finished,
// or "Preview: {home} vs {away} — {date}" beforehand — so the ticker can
// read team names/scores straight out of the title already stored, no new
// structured fields needed.
const FINISHED_PATTERN = /^(.+?) (\d+)-(\d+) (.+)$/;
const PREVIEW_PATTERN = /^Preview: (.+?) vs (.+?) — (.+)$/;

interface TickerArticle {
  id: string;
  slug: string;
  title: string;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
}

function parseTick(article: TickerArticle) {
  const finished = article.title.match(FINISHED_PATTERN);
  if (finished) {
    const [, home, homeScore, awayScore, away] = finished;
    return { home, away, status: "FT", score: `${homeScore}–${awayScore}` };
  }
  const preview = article.title.match(PREVIEW_PATTERN);
  if (preview) {
    const [, home, away, date] = preview;
    return { home, away, status: date.toUpperCase(), score: null };
  }
  return null;
}

async function getTickerArticles(): Promise<TickerArticle[]> {
  return db.article.findMany({
    where: {
      status: "published",
      category: { startsWith: "football" },
      homeCrestUrl: { not: null },
      awayCrestUrl: { not: null },
    },
    orderBy: [{ publishedAt: "desc" }],
    take: 10,
    select: { id: true, slug: true, title: true, homeCrestUrl: true, awayCrestUrl: true },
  });
}

export default async function MatchTicker() {
  const articles = await getTickerArticles();
  const ticks = articles
    .map((article) => {
      const parsed = parseTick(article);
      return parsed ? { ...parsed, id: article.id, slug: article.slug, homeCrestUrl: article.homeCrestUrl!, awayCrestUrl: article.awayCrestUrl! } : null;
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  if (ticks.length === 0) return null;

  // Rendered twice back-to-back so a -50% translateX loop is seamless.
  const doubled = [...ticks, ...ticks];

  return (
    <Box
      sx={{
        bgcolor: "#e9f1ec",
        borderBottom: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes sw-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sw-ticker-track { animation: none !important; }
        }
      `}</style>
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          px: 2,
          bgcolor: "#e9f1ec",
          borderRight: "1px solid",
          borderColor: "divider",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: 11.5,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "primary.main",
        }}
      >
        Results
      </Box>
      <Box
        className="sw-ticker-track"
        sx={{
          display: "flex",
          width: "max-content",
          animation: "sw-ticker-scroll 40s linear infinite",
          pl: "128px",
          "&:hover": { animationPlayState: "paused" },
        }}
      >
        {doubled.map((tick, i) => (
          <Link key={`${tick.id}-${i}`} href={`/article/${tick.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.1,
                px: 2.5,
                py: 1.4,
                borderRight: "1px solid",
                borderColor: "divider",
                whiteSpace: "nowrap",
                fontSize: 13.5,
              }}
            >
              <img src={tick.homeCrestUrl} alt="" width={19} height={19} />
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>
                {tick.home}
              </Box>
              {tick.score ? (
                <Box component="span" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                  {tick.score}
                </Box>
              ) : (
                <Box component="span" sx={{ color: "text.secondary" }}>v</Box>
              )}
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>
                {tick.away}
              </Box>
              <img src={tick.awayCrestUrl} alt="" width={19} height={19} />
              <Box
                component="span"
                sx={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  color: tick.score ? "text.secondary" : "primary.main",
                }}
              >
                {tick.status}
              </Box>
            </Box>
          </Link>
        ))}
      </Box>
    </Box>
  );
}
