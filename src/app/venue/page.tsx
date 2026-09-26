import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { VENUES } from "@/lib/venues";

// Every ground with its own page (lib/venues.ts), grouped by country.
export const metadata = {
  title: "Cricket Venues: Grounds, Fixtures & Results",
  description: "Guides to the major cricket grounds — upcoming fixtures, recent results and the latest stories from each venue on Sports Wire Live.",
  alternates: { canonical: "/venue" },
};

export default function VenuesPage() {
  const countries = [...new Set(VENUES.map((v) => v.country))];
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs steps={[{ name: "Home", href: "/" }]} current="Venues" />
      <Typography variant="h4" component="h1" sx={{ mt: 2, mb: 3 }}>Venues</Typography>
      {countries.map((country) => (
        <Stack key={country} spacing={1.5} sx={{ mb: 4 }}>
          <Typography variant="h6" component="h2">{country}</Typography>
          {VENUES.filter((v) => v.country === country).map((v) => (
            <Link key={v.slug} href={`/venue/${v.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Card variant="outlined" sx={{ p: 2, "&:hover": { borderColor: "primary.main" } }}>
                <Typography sx={{ fontWeight: 600 }}>{v.name}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>{v.city}</Typography>
              </Card>
            </Link>
          ))}
        </Stack>
      ))}
    </Container>
  );
}
