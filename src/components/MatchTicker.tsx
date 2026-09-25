import Link from "next/link";
import Box from "@mui/material/Box";
import { fetchLiveNow } from "@/lib/scores/scoreboard";
import type { ScoreMatch, ScoreSide } from "@/lib/scores/scoreboardModel";
import { LiveBadge, PausedBadge, TeamCrest } from "./scores/ScoreCard";
import { KickoffTime } from "./scores/KickoffTime";

// Site-wide score strip under the header. Mini versions of the standard
// score card (src/components/scores/ScoreCard.tsx) from the same data and
// live/final/upcoming rules as /scores (fetchLiveNow): live games first,
// then the next kickoffs, then recent results. Was its own query and card
// style, with "LIVE" guessed from kickoff time and no clock.
const TICKER_SIZE = 14;
const STRIP_BG = "#e9f1ec";

function MiniTeam({ side, muted }: { side: ScoreSide; muted: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: muted ? "text.secondary" : "text.primary" }}>
      <TeamCrest side={side} size={16} />
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontWeight: side.winner ? 700 : 500 }}>
        {side.name}
      </Box>
      {side.score !== null && (
        <Box component="span" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: side.winner ? 700 : 600, pl: 1 }}>
          {side.score}
        </Box>
      )}
    </Box>
  );
}

function MiniCard({ match }: { match: ScoreMatch }) {
  const isFinal = match.state === "final";
  return (
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Box
        sx={{
          width: 200,
          mx: 0.6,
          my: 0.9,
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: match.state === "live" ? "rgba(211, 47, 47, 0.35)" : "divider",
          fontSize: 12.5,
          lineHeight: 1.5,
          whiteSpace: "nowrap",
          transition: "box-shadow 0.15s, border-color 0.15s",
          "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.1)", borderColor: "primary.main" },
        }}
      >
        <Box sx={{ fontSize: 11, color: "text.secondary", display: "flex", justifyContent: "space-between", gap: 1, mb: 0.25 }}>
          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {match.state === "live" ? (
              <LiveBadge label={match.clock} />
            ) : match.state === "paused" ? (
              <PausedBadge label={match.clock} />
            ) : isFinal ? (
              "Final"
            ) : match.kickoffAt ? (
              <KickoffTime iso={match.kickoffAt} withDate />
            ) : (
              "Upcoming"
            )}
          </Box>
          {match.broadcast && <span>{match.broadcast}</span>}
        </Box>
        <MiniTeam side={match.home} muted={isFinal && !match.home.winner} />
        <MiniTeam side={match.away} muted={isFinal && !match.away.winner} />
      </Box>
    </Link>
  );
}

export default async function MatchTicker() {
  const matches = await fetchLiveNow({ take: TICKER_SIZE });
  if (matches.length === 0) return null;
  // Doubled so the -50% scroll loops seamlessly.
  const doubled = [...matches, ...matches];

  return (
    <Box
      sx={{
        display: { xs: "none", sm: "block" },
        bgcolor: STRIP_BG,
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
      {/* Right-edge fade so cards scroll out smoothly instead of being
          hard-clipped by the container edge. */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: 48,
          zIndex: 2,
          pointerEvents: "none",
          background: `linear-gradient(to right, rgba(233,241,236,0), ${STRIP_BG})`,
        }}
      />
      {/* Plain <Link> wrapper: this is a server component, and MUI Box
          can't take component={Link} across the server/client boundary. */}
      <Link href="/scores" aria-label="All scores" style={{ position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 3, display: "flex", textDecoration: "none" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: 2,
          pr: 1.5,
          background: "linear-gradient(135deg, #2f8a5c 0%, #17512f 100%)",
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#fff", mr: 1 }} />
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
      </Box>
      </Link>
      <Box
        className="sw-ticker-track"
        sx={{
          display: "flex",
          width: "max-content",
          animation: "sw-ticker-scroll 90s linear infinite",
          pl: "120px",
          "&:hover": { animationPlayState: "paused" },
        }}
      >
        {doubled.map((match, i) => (
          <MiniCard key={`${match.id}-${i}`} match={match} />
        ))}
      </Box>
    </Box>
  );
}
