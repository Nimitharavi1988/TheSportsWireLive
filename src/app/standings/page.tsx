import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import { STANDINGS_LEAGUES } from "@/lib/ingestion/standings";

export const metadata = { title: "League Standings" };

export default function StandingsIndexPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        League Standings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Full tables for every league we cover.
      </Typography>
      <Stack spacing={1.5}>
        {STANDINGS_LEAGUES.map((league) => (
          <Link key={league.code} href={`/standings/${league.code}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Card variant="outlined" sx={{ "&:hover": { borderColor: "primary.main" } }}>
              <CardContent>
                <Typography variant="h6">{league.name}</Typography>
              </CardContent>
            </Card>
          </Link>
        ))}
      </Stack>
    </Container>
  );
}
