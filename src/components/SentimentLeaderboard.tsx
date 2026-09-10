import Link from "next/link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { getSentimentLeaderboard, DOMINANT_EMOJI } from "@/lib/sentimentLeaderboard";

export async function SentimentLeaderboard() {
  const entries = await getSentimentLeaderboard();
  if (entries.length === 0) return null;

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2, mt: 3 }}>
      <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, mb: 1, display: "block" }}>
        Fan Sentiment (24h)
      </Typography>
      <Stack spacing={0.75}>
        {entries.map((entry) => (
          <Link key={entry.href} href={entry.href} style={{ textDecoration: "none", color: "inherit" }}>
            <Stack
              direction="row"
              spacing={1.25}
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                p: 0.75,
                borderRadius: 2,
                transition: "background-color 0.15s",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
                {entry.name}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                <Typography variant="body2">{DOMINANT_EMOJI[entry.dominant]}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {entry.total}
                </Typography>
              </Box>
            </Stack>
          </Link>
        ))}
      </Stack>
    </Paper>
  );
}
