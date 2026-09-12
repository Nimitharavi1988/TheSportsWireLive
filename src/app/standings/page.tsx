import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { STANDINGS_LEAGUES } from "@/lib/ingestion/standings";

export const metadata = { title: "League Standings", alternates: { canonical: "/standings" } };

export default function StandingsIndexPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        League Standings
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: "text.secondary",
          mb: 3
        }}>
        Full tables for every league we cover.
      </Typography>
      <Stack spacing={1.25}>
        {STANDINGS_LEAGUES.map((league) => (
          <Link key={league.code} href={`/standings/${league.code}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                transition: "border-color 0.15s, background-color 0.15s",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(29, 107, 63, 0.08)",
                }}
              >
                <EmojiEventsIcon sx={{ color: "primary.main", fontSize: 20 }} />
              </Box>
              <Typography variant="h6" sx={{ flex: 1 }}>
                {league.name}
              </Typography>
              <ChevronRightIcon sx={{ color: "text.secondary" }} />
            </Paper>
          </Link>
        ))}
      </Stack>
    </Container>
  );
}
