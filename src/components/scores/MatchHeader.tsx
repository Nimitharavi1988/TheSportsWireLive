"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ScoreMatch, ScoreSide } from "@/lib/scores/scoreboardModel";
import { KickoffTime } from "./KickoffTime";
import { LiveBadge, PausedBadge, StartedBadge, TeamCrest } from "./ScoreCard";
import { DataSource } from "./DataFreshness";
import { useLiveScores } from "./useLiveScores";

// Large form of the score card, shown at the top of a match story (the
// "match page"): league and status, big crests, score, records, the
// situation line, venue and TV. Updates itself in place while the game is
// live (useLiveScores), so the story page is never reloaded for a score.

function Side({ side, isFinal }: { side: ScoreSide; isFinal: boolean }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, minWidth: 0, color: isFinal && !side.winner ? "text.secondary" : "text.primary" }}>
      <TeamCrest side={side} size={56} />
      <Typography sx={{ fontSize: 15, fontWeight: side.winner ? 700 : 600, textAlign: "center", lineHeight: 1.25 }}>{side.name}</Typography>
      {side.record && <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{side.record}</Typography>}
    </Box>
  );
}

export function MatchHeader({ match: initial }: { match: ScoreMatch }) {
  const [match] = useLiveScores([initial], { mode: "merge" }).concat(initial);
  const isFinal = match.state === "final";
  const hasScores = match.home.score !== null || match.away.score !== null;
  // Cricket scores are text ("287/6 (48.2)") — too long for one big line.
  const isTextScore = /[^\d]/.test(`${match.home.score ?? ""}${match.away.score ?? ""}`);

  return (
    <Box
      component="section"
      aria-label="Match score"
      sx={{ border: "1px solid", borderColor: match.state === "live" ? "rgba(211, 47, 47, 0.35)" : "divider", borderRadius: 2, p: { xs: 2, sm: 2.5 }, mb: 2.5, bgcolor: "background.paper" }}
    >
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, flexWrap: "wrap", fontSize: 13, color: "text.secondary", mb: 2 }}>
        <span>{match.leagueLabel}</span>
        <span aria-hidden>·</span>
        {match.state === "live" ? (
          <LiveBadge label={match.clock} />
        ) : match.state === "paused" ? (
          <PausedBadge label={match.clock} />
        ) : match.state === "started" ? (
          <StartedBadge />
        ) : isFinal ? (
          <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>Final</Box>
        ) : match.kickoffAt ? (
          <KickoffTime iso={match.kickoffAt} withDate />
        ) : (
          <span>Upcoming</span>
        )}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: { xs: 1.5, sm: 3 } }}>
        <Side side={match.home} isFinal={isFinal} />
        <Box sx={{ textAlign: "center" }}>
          {hasScores ? (
            isTextScore ? (
              <Box sx={{ display: "grid", gap: 0.5, fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                <span>{match.home.score ?? "–"}</span>
                <Box component="span" sx={{ fontSize: 12, color: "text.secondary", fontWeight: 500 }}>v</Box>
                <span>{match.away.score ?? "–"}</span>
              </Box>
            ) : (
              <Typography component="div" sx={{ fontSize: { xs: 32, sm: 40 }, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1, whiteSpace: "nowrap" }}>
                {match.home.score ?? "–"}
                <Box component="span" sx={{ mx: 1.25, color: "text.disabled", fontWeight: 400 }}>–</Box>
                {match.away.score ?? "–"}
              </Typography>
            )
          ) : (
            <Typography sx={{ fontSize: 18, fontWeight: 600, color: "text.secondary" }}>vs</Typography>
          )}
        </Box>
        <Side side={match.away} isFinal={isFinal} />
      </Box>

      {match.note && <Typography sx={{ mt: 2, fontSize: 14, textAlign: "center", fontWeight: 600 }}>{match.note}</Typography>}
      {(match.venue || match.broadcast) && (
        <Typography sx={{ mt: 1, fontSize: 12, textAlign: "center", color: "text.secondary" }}>
          {[match.venue, match.broadcast ? `TV: ${match.broadcast}` : null].filter(Boolean).join(" · ")}
        </Typography>
      )}
      <Typography component="div" sx={{ mt: 1, fontSize: 11, textAlign: "center", color: "text.disabled" }}>
        Source: <DataSource match={match} />
      </Typography>
    </Box>
  );
}
