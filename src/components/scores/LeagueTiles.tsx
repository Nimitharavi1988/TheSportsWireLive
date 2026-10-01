import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import type { MatchEvent } from "@/lib/scores/priority";
import { CardSource } from "./DataFreshness";
import { EventChip } from "./ScoreCard";
import { HighlightsToggle } from "./HighlightsToggle";
import { MiniScoreCard } from "./MiniScoreCard";

// One league on /scores: its name as a heading over a grid of the same score
// tiles the homepage uses (MiniScoreCard), three across on a wide screen.
// A tile that just had a goal or wicket carries the event banner beneath it,
// and a finished match with highlights gets the "Watch highlights" toggle.
export function LeagueTiles({ league, matches, events, columns = 3 }: { league: string; matches: ScoreMatch[]; events?: Map<string, MatchEvent>; columns?: 2 | 3 }) {
  return (
    <Box component="section" aria-label={league} sx={{ mb: 3 }}>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, mb: 1 }}>
        {league}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: `repeat(${columns}, minmax(0, 1fr))` }, gap: 1.25, alignItems: "start" }}>
        {matches.map((m) => {
          const event = events?.get(m.id);
          return (
            <Box key={m.id}>
              <MiniScoreCard match={m} fluid showLeague={false} />
              {event && <EventChip event={event} />}
              {m.state === "final" && m.highlight && <HighlightsToggle youtubeId={m.highlight.youtubeId} title={m.highlight.title} />}
            </Box>
          );
        })}
      </Box>
      <Typography component="div" sx={{ mt: 0.75, fontSize: 12, color: "text.disabled" }}>
        <CardSource matches={matches} />
      </Typography>
    </Box>
  );
}
