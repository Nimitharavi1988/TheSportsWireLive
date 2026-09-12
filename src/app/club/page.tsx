import Link from "next/link";
import { TRACKED_CLUBS } from "@/lib/clubs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import ShieldIcon from "@mui/icons-material/Shield";

export const metadata = { title: "Clubs", alternates: { canonical: "/club" } };

// Same reasoning as /player's index — these pages were only reachable via
// the sitemap or incidental article-title tagging, no on-site link existed.
export default function ClubIndexPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Clubs
      </Typography>
      <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
        Browse coverage by club.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" },
          gap: 1.25,
        }}
      >
        {TRACKED_CLUBS.map((club) => (
          <Link key={club.slug} href={`/club/${club.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                display: "flex",
                alignItems: "center",
                gap: 1,
                transition: "border-color 0.15s, background-color 0.15s",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(29, 107, 63, 0.08)",
                }}
              >
                <ShieldIcon sx={{ color: "primary.main", fontSize: 17 }} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                {club.name}
              </Typography>
            </Paper>
          </Link>
        ))}
      </Box>
    </Container>
  );
}
