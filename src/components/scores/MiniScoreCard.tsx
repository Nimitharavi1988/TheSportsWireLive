import Link from "next/link";
import Box from "@mui/material/Box";
import type { ScoreMatch, ScoreSide } from "@/lib/scores/scoreboardModel";
import { LiveBadge, PausedBadge, TeamCrest } from "./ScoreCard";
import { KickoffTime } from "./KickoffTime";

// Small form of the standard score card — status on top, one row per team.
// Used by the site-wide score strip (MatchTicker) and the phone score row
// at the top of the homepage (MobileScoresRow). Server-renderable.

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

export function MiniScoreCard({ match }: { match: ScoreMatch }) {
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
