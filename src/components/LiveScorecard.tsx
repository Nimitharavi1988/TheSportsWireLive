import Link from "next/link";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";

export interface LiveMatchRow {
  id: string;
  slug: string;
  summary: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
}

// A Google-style live score card: pulsing LIVE badge, bigger team crests,
// and the rich per-innings status text (cricketData.ts's summary, e.g.
// "India need 45 runs. India Inning: 187/4 (18.2 ov)...") as the main
// content — that data was already being fetched and stored every poll, it
// just wasn't surfaced anywhere prominently before. Shared between /scores
// and the homepage sidebar so both stay visually identical.
export function LiveScorecard({ match, compact = false }: { match: LiveMatchRow; compact?: boolean }) {
  return (
    <Link href={`/article/${match.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Paper
        variant="outlined"
        sx={{
          p: compact ? 1.75 : 2.25,
          borderColor: "primary.main",
          borderWidth: 1.5,
          transition: "background-color 0.15s",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: compact ? 1 : 1.5 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: "#d32f2f",
              animation: "sw-live-pulse 1.5s ease-in-out infinite",
              "@keyframes sw-live-pulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
            }}
          />
          <Typography variant="caption" sx={{ color: "#d32f2f", fontWeight: 700, letterSpacing: "0.05em" }}>
            LIVE
          </Typography>
        </Stack>
        <Stack direction="row" spacing={compact ? 1 : 1.5} sx={{ alignItems: "center", mb: compact ? 1 : 1.25, flexWrap: "wrap" }}>
          {match.homeCrestUrl && <img src={match.homeCrestUrl} alt="" width={compact ? 26 : 36} height={compact ? 26 : 36} />}
          <Typography variant="h6" sx={{ fontSize: compact ? 15 : 18, fontWeight: 700 }}>
            {match.homeTeam}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: compact ? 13 : 14 }}>v</Typography>
          <Typography variant="h6" sx={{ fontSize: compact ? 15 : 18, fontWeight: 700 }}>
            {match.awayTeam}
          </Typography>
          {match.awayCrestUrl && <img src={match.awayCrestUrl} alt="" width={compact ? 26 : 36} height={compact ? 26 : 36} />}
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: compact ? 12.5 : 14 }}>
          {match.summary}
        </Typography>
      </Paper>
    </Link>
  );
}
