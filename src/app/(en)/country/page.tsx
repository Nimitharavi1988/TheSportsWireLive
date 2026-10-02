import Link from "next/link";
import { TRACKED_COUNTRIES } from "@/lib/countries";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import PublicIcon from "@mui/icons-material/Public";

export const metadata = { title: "Countries", alternates: { canonical: "/country" } };

// Mirrors club/page.tsx exactly -- same reachability reasoning (only
// reachable via the sitemap or incidental article-title tagging otherwise).
export default function CountryIndexPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Countries
      </Typography>
      <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
        Browse coverage by country.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" },
          gap: 1.25,
        }}
      >
        {TRACKED_COUNTRIES.map((country) => (
          <Link key={country.slug} href={`/country/${country.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
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
                <PublicIcon sx={{ color: "primary.main", fontSize: 17 }} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                {country.name}
              </Typography>
            </Paper>
          </Link>
        ))}
      </Box>
    </Container>
  );
}
