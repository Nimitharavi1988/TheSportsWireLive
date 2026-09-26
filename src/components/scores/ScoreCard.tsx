import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ScoreMatch, ScoreSide } from "@/lib/scores/scoreboardModel";
import { KickoffTime } from "./KickoffTime";
import { CardSource } from "./DataFreshness";
import { TeamCrest } from "@/components/TeamCrest";

// Score list, modelled on Google's sports cards: one card per league, one
// row per match — both teams stacked on the left (crest, name, record),
// scores right-aligned, and a status column on the far right (LIVE clock in
// red, break, kick-off time, Final). Winner bold, loser grey. The match
// header (MatchHeader.tsx) is the large single-match form. Plain <Link>
// rows (not Box component={Link}) so this also renders from server
// components.

export const LIVE_RED = "#d32f2f";

export function LiveBadge({ label }: { label: string | null }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: LIVE_RED, fontWeight: 700 }}>
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: LIVE_RED,
          animation: "swlLivePulse 1.6s ease-in-out infinite",
          "@keyframes swlLivePulse": { "50%": { opacity: 0.3 } },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />
      <span>{label ? `LIVE · ${label}` : "LIVE"}</span>
    </Box>
  );
}

// A started game in a break (cricket stumps/lunch/tea): muted, no pulse —
// nothing is happening, so it shouldn't read as LIVE.
export function PausedBadge({ label }: { label: string | null }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: "text.secondary", fontWeight: 700 }}>
      <Box component="span" aria-hidden sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "text.disabled" }} />
      <span>{label ?? "Paused"}</span>
    </Box>
  );
}

// Past its start with no live data to show (see ScoreState "started").
export function StartedBadge() {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: "text.secondary", fontWeight: 700 }}>
      <Box component="span" aria-hidden sx={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid", borderColor: "text.disabled" }} />
      <span>In progress</span>
    </Box>
  );
}

function Team({ side, muted, bold }: { side: ScoreSide; muted: boolean; bold: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 28, minWidth: 0, color: muted ? "text.secondary" : "text.primary" }}>
      <TeamCrest name={side.name} crestUrl={side.crestUrl} size={20} />
      <Typography component="span" noWrap sx={{ fontSize: 15, fontWeight: bold ? 700 : 400 }}>
        {side.name}
      </Typography>
      {side.record && <Typography component="span" sx={{ fontSize: 12, color: "text.secondary", flexShrink: 0 }}>{side.record}</Typography>}
    </Box>
  );
}

// Right-hand status column.
function StatusColumn({ match }: { match: ScoreMatch }) {
  if (match.state === "live") {
    return (
      <Box sx={{ color: LIVE_RED, fontWeight: 700 }}>
        <div>LIVE</div>
        {match.clock && <Box sx={{ fontWeight: 500 }}>{match.clock}</Box>}
      </Box>
    );
  }
  if (match.state === "paused") return <span>{match.clock ?? "Break"}</span>;
  if (match.state === "started") return <span>In progress</span>;
  if (match.state === "final") return <Box component="span" sx={{ color: "text.primary", fontWeight: 500 }}>Final</Box>;
  return (
    <Box>
      {match.kickoffAt ? <KickoffTime iso={match.kickoffAt} /> : <span>Upcoming</span>}
      {match.broadcast && <Box sx={{ fontSize: 11, color: "text.disabled" }}>{match.broadcast}</Box>}
    </Box>
  );
}

export function ScoreRow({ match }: { match: ScoreMatch }) {
  const isFinal = match.state === "final";
  const hasScores = match.home.score !== null || match.away.score !== null;
  const score = (side: ScoreSide) => (
    <Typography component="div" sx={{ fontSize: 15, lineHeight: "28px", fontWeight: isFinal && side.winner ? 700 : 500, color: isFinal && !side.winner ? "text.secondary" : "text.primary", whiteSpace: "nowrap" }}>
      {side.score ?? ""}
    </Typography>
  );
  return (
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto 84px",
          columnGap: 1.5,
          alignItems: "center",
          px: 2,
          py: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          transition: "background-color 0.15s",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Team side={match.home} muted={isFinal && !match.home.winner} bold={isFinal && match.home.winner} />
          <Team side={match.away} muted={isFinal && !match.away.winner} bold={isFinal && match.away.winner} />
        </Box>
        <Box sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {hasScores && (
            <>
              {score(match.home)}
              {score(match.away)}
            </>
          )}
        </Box>
        <Box sx={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "flex-end", textAlign: "right", pl: 1.5, borderLeft: "1px solid", borderColor: "divider", fontSize: 12, color: "text.secondary", lineHeight: 1.35 }}>
          <StatusColumn match={match} />
        </Box>
        {match.note && (
          <Typography sx={{ gridColumn: "1 / -1", mt: 0.25, fontSize: 12, color: "text.secondary", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {match.note}
          </Typography>
        )}
      </Box>
    </Link>
  );
}

// One league's matches in a single card, with where the data comes from.
export function LeagueScoresCard({ league, matches }: { league: string; matches: ScoreMatch[] }) {
  return (
    <Box component="section" aria-label={league} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden" }}>
      <Typography component="h2" sx={{ px: 2, py: 1.25, fontSize: 15, fontWeight: 700 }}>
        {league}
      </Typography>
      {matches.map((m) => (
        <ScoreRow key={m.id} match={m} />
      ))}
      <Typography component="div" sx={{ px: 2, py: 0.75, fontSize: 11, color: "text.disabled", borderTop: "1px solid", borderColor: "divider" }}>
        <CardSource matches={matches} />
      </Typography>
    </Box>
  );
}
