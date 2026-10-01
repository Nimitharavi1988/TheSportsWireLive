import Box from "@mui/material/Box";
import { readMatchDetail } from "@/lib/scores/matchDetailRead";
import { resolveScorecardLinks } from "@/lib/scores/playerLinksRead";
import type { Scorecard } from "@/lib/scores/cricketScorecard";
import { CricketScorecardView } from "./CricketScorecardView";

// The stored scorecard for a match (matchDetailSync.ts keeps it current), or
// null. Not read from ESPN here: the live site's servers can't rely on ESPN.
async function storedScorecard(articleId: string): Promise<Scorecard | null> {
  const detail = await readMatchDetail(articleId);
  return detail?.kind === "cricket" ? detail.card : null;
}

const hasContent = (card: Scorecard, inPlay: boolean) => card.innings.length > 0 || (inPlay && card.yetToBat.length > 0);

// Full scorecard under the match header. The first render comes from the stored
// copy; CricketScorecardView draws it and, for a live match, keeps it current.
export async function CricketScorecard({ articleId, inPlay, teams }: { articleId: string; inPlay: boolean; teams: string[] }) {
  const card = await storedScorecard(articleId);
  // A live match still has a tab to show (the side yet to bat) before an innings exists.
  if (!card || !hasContent(card, inPlay)) return null;
  return <CricketScorecardView initial={card} initialLinks={await resolveScorecardLinks(card)} articleId={articleId} inPlay={inPlay} teams={teams} />;
}

// "Full scorecard" under the match header. The scorecard sits below the score
// and the highlights video, a long way down a phone — easy to miss — so this
// jumps straight to it. Shown only when there is a scorecard to jump to.
export async function ScorecardJump({ articleId, inPlay }: { articleId: string; inPlay: boolean }) {
  const card = await storedScorecard(articleId);
  if (!card || !hasContent(card, inPlay)) return null;
  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: -1, mb: 2.5 }}>
      <Box
        component="a"
        href="#scorecard"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          px: 2,
          py: 0.75,
          borderRadius: 5,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          color: "primary.main",
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
        }}
      >
        {inPlay && <Box component="span" aria-hidden sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#d32f2f" }} />}
        {inPlay ? "Live scorecard" : "Full scorecard"}: batting &amp; bowling <span aria-hidden>↓</span>
      </Box>
    </Box>
  );
}
