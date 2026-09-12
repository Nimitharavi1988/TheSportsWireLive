import { db } from "@/lib/db";
import Link from "next/link";
import Box from "@mui/material/Box";

interface TickerArticle {
  id: string;
  slug: string;
  category: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  matchStatus: string | null;
  kickoffAt: Date | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
}

// Reads the structured match fields (footballData.ts/cricketData.ts/
// nflData.ts) directly instead of regex-parsing the title — needed once
// cricket/NFL are included here too, since their title shapes differ from
// football's (and cricket has no single home/away score to begin with; see
// the schema comment on Article.homeScore).
function parseTick(article: TickerArticle) {
  if (!article.homeTeam || !article.awayTeam) return null;

  const hasScore = article.homeScore !== null && article.awayScore !== null;
  // A "scheduled" match with a kickoffAt already in the past is a cricket
  // match already underway (cricketData.ts's currentMatches source — see
  // the schema comment on Article.matchStatus) rather than a genuinely
  // upcoming fixture. Same distinction /scores makes for its "In Progress"
  // section — without it this just showed the kickoff date, indistinguishable
  // from a real future fixture.
  const isInProgress = article.matchStatus !== "finished" && (article.kickoffAt?.getTime() ?? Infinity) < Date.now();
  const status =
    article.matchStatus === "finished"
      ? hasScore ? "FT" : "Result"
      : isInProgress
        ? "LIVE"
        : (article.kickoffAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? "").toUpperCase();

  return {
    home: article.homeTeam,
    away: article.awayTeam,
    status,
    score: hasScore ? `${article.homeScore}–${article.awayScore}` : null,
    isLive: isInProgress,
  };
}

async function getTickerArticles(): Promise<TickerArticle[]> {
  return db.article.findMany({
    where: {
      status: "published",
      matchStatus: { not: null },
      homeCrestUrl: { not: null },
      awayCrestUrl: { not: null },
    },
    // createdAt, not kickoffAt — a scheduled match's kickoffAt can be weeks
    // out, which would float distant future fixtures above genuinely recent
    // activity (same bug, same fix, as the RSS feed's ordering earlier).
    orderBy: [{ createdAt: "desc" }],
    take: 12,
    select: {
      id: true, slug: true, category: true, homeTeam: true, awayTeam: true,
      homeScore: true, awayScore: true, matchStatus: true, kickoffAt: true,
      homeCrestUrl: true, awayCrestUrl: true,
    },
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
        // Hidden below `sm` — a horizontally-scrolling marquee needs real
        // width to read well, and on a narrow phone screen it was eating
        // the entire top of the page (team names cut off mid-scroll) before
        // any actual headline. The same results already appear properly,
        // full-width, in the "Match Results & Previews" section below.
        display: { xs: "none", sm: "block" },
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
      {/* Right-edge fade so items scroll out of view smoothly rather than
          getting hard-clipped mid-crest by the container edge. */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: 48,
          zIndex: 2,
          pointerEvents: "none",
          background: "linear-gradient(to right, rgba(233,241,236,0), #e9f1ec)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 3,
          display: "flex",
          alignItems: "center",
          pl: 2,
          pr: 1.5,
          bgcolor: "primary.main",
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: "#fff",
            mr: 1,
          }}
        />
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: 11.5,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "primary.contrastText",
            whiteSpace: "nowrap",
          }}
        >
          Scores
        </Box>
        {/* Angled edge so the badge reads as a distinct tag rather than a
            plain rectangle butting into the scrolling track. */}
        <Box
          sx={{
            width: 0,
            height: 0,
            borderTop: "18px solid transparent",
            borderBottom: "18px solid transparent",
            borderLeft: "10px solid",
            borderLeftColor: "primary.main",
            ml: 1.5,
          }}
        />
      </Box>
      <Box
        className="sw-ticker-track"
        sx={{
          display: "flex",
          width: "max-content",
          animation: "sw-ticker-scroll 40s linear infinite",
          pl: "148px",
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
                transition: "background-color 0.15s",
                "&:hover": { bgcolor: "rgba(29, 107, 63, 0.06)" },
              }}
            >
              <img src={tick.homeCrestUrl} alt="" width={19} height={19} />
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>
                {tick.home}
              </Box>
              {tick.score ? (
                <Box
                  component="span"
                  sx={{
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 4,
                    px: 0.9,
                    py: 0.15,
                  }}
                >
                  {tick.score}
                </Box>
              ) : (
                <Box component="span" sx={{ color: "text.secondary" }}>v</Box>
              )}
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>
                {tick.away}
              </Box>
              <img src={tick.awayCrestUrl} alt="" width={19} height={19} />
              {tick.isLive && (
                <Box
                  component="span"
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    bgcolor: "#d32f2f",
                    flexShrink: 0,
                    animation: "sw-ticker-live-pulse 1.5s ease-in-out infinite",
                    "@keyframes sw-ticker-live-pulse": {
                      "0%, 100%": { opacity: 1 },
                      "50%": { opacity: 0.3 },
                    },
                  }}
                />
              )}
              <Box
                component="span"
                sx={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  color: tick.isLive ? "#d32f2f" : tick.score ? "text.secondary" : "primary.main",
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
