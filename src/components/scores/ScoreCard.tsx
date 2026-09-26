import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ScoreMatch, ScoreSide } from "@/lib/scores/scoreboardModel";
import { playerInitials } from "@/lib/playerAvatar";
import { KickoffTime } from "./KickoffTime";
import { DataSource } from "./DataFreshness";

// The standard score card (Google/ESPN pattern): a status line, then one
// row per team — crest, name, record, score — winner bold, loser muted.
// Used by /scores; the match header (MatchHeader.tsx) is its large form.
// A plain <Link> wrapper (not Box component={Link}) so this also renders
// from server components.

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

export function TeamCrest({ side, size }: { side: Pick<ScoreSide, "name" | "crestUrl">; size: number }) {
  if (side.crestUrl) {
    // next/image directly, not Box component={Image}: MUI can't receive a
    // component function from a server component.
    return <Image src={side.crestUrl} alt="" width={size} height={size} style={{ objectFit: "contain", flexShrink: 0, width: size, height: size }} />;
  }
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: "action.hover",
        color: "text.secondary",
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {playerInitials(side.name).slice(0, 2)}
    </Box>
  );
}

function TeamRow({ side, isFinal }: { side: ScoreSide; isFinal: boolean }) {
  const muted = isFinal && !side.winner;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 28, color: muted ? "text.secondary" : "text.primary" }}>
      <TeamCrest side={side} size={22} />
      <Typography component="span" noWrap sx={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: side.winner ? 700 : 500 }}>
        {side.name}
        {side.record && (
          <Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: "text.secondary" }}>
            {side.record}
          </Box>
        )}
      </Typography>
      <Typography
        component="span"
        sx={{ fontSize: 15, fontWeight: side.winner ? 700 : 600, fontVariantNumeric: "tabular-nums", textAlign: "right", flexShrink: 0 }}
      >
        {side.score ?? ""}
      </Typography>
    </Box>
  );
}

export function ScoreStatus({ match }: { match: ScoreMatch }) {
  if (match.state === "live") return <LiveBadge label={match.clock} />;
  if (match.state === "paused") return <PausedBadge label={match.clock} />;
  if (match.state === "started") return <StartedBadge />;
  if (match.state === "final") return <span>Final</span>;
  return match.kickoffAt ? <KickoffTime iso={match.kickoffAt} /> : <span>Upcoming</span>;
}

export function ScoreCard({ match }: { match: ScoreMatch }) {
  const isFinal = match.state === "final";
  return (
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Box
        sx={{
          height: "100%",
          px: 1.5,
          py: 1.25,
          borderRadius: 2,
          border: "1px solid",
          borderColor: match.state === "live" ? "rgba(211, 47, 47, 0.35)" : "divider",
          bgcolor: "background.paper",
          transition: "border-color 0.15s, box-shadow 0.15s",
          "&:hover": { borderColor: "primary.main", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5, fontSize: 12, color: "text.secondary" }}>
          <ScoreStatus match={match} />
          {match.broadcast && <span>{match.broadcast}</span>}
        </Box>
        <TeamRow side={match.home} isFinal={isFinal} />
        <TeamRow side={match.away} isFinal={isFinal} />
        {match.note && (
          <Typography
            sx={{ mt: 0.5, fontSize: 12, color: "text.secondary", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {match.note}
          </Typography>
        )}
        <Typography component="div" sx={{ mt: 0.5, fontSize: 11, color: "text.disabled" }}>
          <DataSource match={match} />
        </Typography>
      </Box>
    </Link>
  );
}
