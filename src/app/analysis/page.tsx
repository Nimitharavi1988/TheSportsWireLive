import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { AnalysisList } from "@/components/AnalysisList";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { fetchAnalysis } from "@/lib/analysis";

// Every story written by the site's own writers — previews, analysis,
// opinion, features (see admin Write a story).
export const revalidate = 300;

export async function generateMetadata() {
  // Not offered to search engines while it's still empty.
  const empty = (await fetchAnalysis({ limit: 1 })).length === 0;
  return {
    title: "Analysis, Previews & Opinion from Our Writers",
    description: "Match previews, tactical analysis, opinion and features written by the Sports Wire Live team across cricket, football, the NFL and more.",
    alternates: { canonical: "/analysis" },
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function AnalysisPage() {
  const items = await fetchAnalysis({ limit: 100 });
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs steps={[{ name: "Home", href: "/" }]} current="Analysis" />
      <Typography variant="h4" component="h1" sx={{ mt: 2, mb: 1 }}>Analysis</Typography>
      <Typography sx={{ color: "text.secondary", mb: 4 }}>
        Previews, analysis and opinion written by the Sports Wire Live team.
      </Typography>
      {items.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>Our first pieces are on the way.</Typography>
      ) : (
        <AnalysisList items={items} showSummary />
      )}
    </Container>
  );
}
