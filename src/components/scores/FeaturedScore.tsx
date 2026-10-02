import Link from "next/link";
import Box from "@mui/material/Box";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ScoreMatch, ScoreSide } from "@/lib/scores/scoreboardModel";
import { splitScore } from "@/lib/scores/displayScore";
import { TeamCrest } from "@/components/TeamCrest";
import { shortLeague, Status } from "./MiniScoreCard";
import { getDict } from "@/lib/i18n/dictionary";

// The lead game in the homepage panel: the same tile language as
// MiniScoreCard at a larger scale — bigger crests and scores, the result or
// situation line, and where it is being played — with a clear way in.
function Team({ side, muted }: { side: ScoreSide; muted: boolean }) {
  const { main, detail } = splitScore(side.score);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "32px minmax(0, 1fr) auto", alignItems: "center", columnGap: 1.5, minHeight: 44, color: muted ? "text.secondary" : "text.primary" }}>
      <TeamCrest name={side.name} crestUrl={side.crestUrl} size={32} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, fontWeight: side.winner ? 700 : 600 }}>
        {side.name}
      </Box>
      <Box sx={{ textAlign: "right", lineHeight: 1.1, maxWidth: 150, fontVariantNumeric: "tabular-nums" }}>
        {main && (
          <Box component="div" sx={{ fontSize: 20, fontWeight: 700, whiteSpace: "nowrap" }}>
            {main}
          </Box>
        )}
        {detail && (
          <Box component="div" sx={{ mt: 0.25, fontSize: 12, fontWeight: 400, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {detail}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function FeaturedScore({ match, locale }: { match: ScoreMatch; locale?: string }) {
  const t = getDict(locale).scores;
  const isFinal = match.state === "final";
  const live = match.state === "live";
  const where = [match.venue, match.broadcast].filter(Boolean).join(" · ");
  return (
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Box
        sx={{
          px: 2,
          pt: 1.5,
          pb: 1.25,
          borderRadius: 3,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: live ? "rgba(211, 47, 47, 0.45)" : "divider",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          transition: "box-shadow 0.15s, border-color 0.15s",
          "&:hover": { boxShadow: "0 4px 14px rgba(0,0,0,0.12)", borderColor: live ? "rgba(211, 47, 47, 0.75)" : "primary.main" },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 0.75, fontSize: 12, color: "text.secondary" }}>
          <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
            {shortLeague(match.leagueLabel)}
          </Box>
          <Box component="span" sx={{ flexShrink: 0, whiteSpace: "nowrap", fontWeight: 600 }}>
            <Status match={match} locale={locale} />
          </Box>
        </Box>
        <Team side={match.home} muted={isFinal && !match.home.winner} />
        <Team side={match.away} muted={isFinal && !match.away.winner} />
        {match.note && match.state !== "upcoming" && (
          <Box sx={{ mt: 1, pt: 1, borderTop: "1px solid", borderColor: "divider", fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{match.note}</Box>
        )}
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1, fontSize: 12, color: "text.secondary" }}>
          <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{where}</Box>
          <Box component="span" sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center", color: "primary.main", fontSize: 13, fontWeight: 700 }}>
            {isFinal || live ? t.matchCentre : t.preview}
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Box>
    </Link>
  );
}
