import Link from "next/link";
import Box from "@mui/material/Box";
import type { ScoreMatch, ScoreSide } from "@/lib/scores/scoreboardModel";
import { splitScore } from "@/lib/scores/displayScore";
import { LiveBadge, PausedBadge, StartedBadge } from "./ScoreCard";
import { TeamCrest } from "@/components/TeamCrest";
import { KickoffTime } from "./KickoffTime";

// The score tile, modelled on Google's: the competition and status on one
// line, then one row per team — crest, name, score right-aligned in its own
// column. A long cricket score is split so "322/9" reads at a glance and
// "50 ov" sits small beneath (displayScore.ts); the name column absorbs
// whatever width is left, so nothing is ever pushed out of line. Used by the
// site-wide strip (fixed width) and the homepage panel (`fluid`).
// Server-renderable.

// "West Indies tour of India 2026/27" -> "West Indies tour of India": the season adds width, not meaning.
export const shortLeague = (label: string) => label.replace(/\s+20\d\d(\/\d\d)?$/, "");

function Row({ side, muted, fluid }: { side: ScoreSide; muted: boolean; fluid: boolean }) {
  const split = splitScore(side.score);
  const { main } = split;
  // The narrow strip tile keeps just the overs ("28 ov"); the panel has room for the target too.
  const detail = fluid ? split.detail : split.detail?.split(",")[0] ?? null;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr) auto", alignItems: "center", columnGap: 1, minHeight: 34, color: muted ? "text.secondary" : "text.primary" }}>
      <TeamCrest name={side.name} crestUrl={side.crestUrl} size={22} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: side.winner ? 700 : 500 }}>
        {side.name}
      </Box>
      <Box sx={{ textAlign: "right", lineHeight: 1.15, minWidth: 28, maxWidth: 130, fontVariantNumeric: "tabular-nums" }}>
        {main && (
          <Box component="div" sx={{ fontSize: 15, fontWeight: side.winner ? 800 : 700, whiteSpace: "nowrap" }}>
            {main}
          </Box>
        )}
        {detail && (
          <Box component="div" sx={{ fontSize: 12, fontWeight: 400, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {detail}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function Status({ match }: { match: ScoreMatch }) {
  if (match.state === "live") return <LiveBadge label={match.clock} />;
  if (match.state === "started") return <StartedBadge />;
  if (match.state === "paused") return <PausedBadge label={match.clock} />;
  if (match.state === "final") return <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>Final</Box>;
  return match.kickoffAt ? <KickoffTime iso={match.kickoffAt} withDate /> : <span>Upcoming</span>;
}

// `showLeague` off under a league heading (/scores), where the name would repeat.
export function MiniScoreCard({ match, fluid = false, showLeague = true }: { match: ScoreMatch; fluid?: boolean; showLeague?: boolean }) {
  const isFinal = match.state === "final";
  const live = match.state === "live";
  return (
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Box
        sx={{
          width: fluid ? "auto" : 240,
          mx: fluid ? 0 : 0.6,
          my: fluid ? 0 : 0.9,
          px: 1.5,
          py: 1,
          borderRadius: 3,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: live ? "rgba(211, 47, 47, 0.4)" : "divider",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          transition: "box-shadow 0.15s, border-color 0.15s",
          "&:hover": { boxShadow: "0 3px 10px rgba(0,0,0,0.12)", borderColor: live ? "rgba(211, 47, 47, 0.7)" : "primary.main" },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: showLeague ? "space-between" : "flex-start", alignItems: "center", gap: 1, mb: 0.5, fontSize: 12, color: "text.secondary" }}>
          {showLeague && (
            <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {shortLeague(match.leagueLabel)}
            </Box>
          )}
          <Box component="span" sx={{ flexShrink: 0, whiteSpace: "nowrap", fontWeight: 500 }}>
            <Status match={match} />
          </Box>
        </Box>
        <Row side={match.home} muted={isFinal && !match.home.winner} fluid={fluid} />
        <Row side={match.away} muted={isFinal && !match.away.winner} fluid={fluid} />
        {fluid && match.note && match.state !== "upcoming" && (
          <Box sx={{ mt: 0.5, fontSize: 12, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.note}</Box>
        )}
      </Box>
    </Link>
  );
}
