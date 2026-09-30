import { SeeAllLink } from "./SeeAllLink";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AnalysisList } from "./AnalysisList";
import { fetchAnalysis } from "@/lib/analysis";

const SHOWN = 3;

// The latest pieces by the site's own writers, as a compact box at the bottom
// of the home page's right-hand column (and a sport's page, for that sport) —
// never above the hero. Renders nothing until there are some.
export async function AnalysisStrip({ category }: { category?: string }) {
  const items = await fetchAnalysis({ category, limit: SHOWN }).catch(() => []);
  if (items.length === 0) return null;
  return (
    <Paper component="section" aria-label="Analysis" variant="outlined" sx={{ p: 2.5, mt: 3 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6" component="h2" sx={{ fontFamily: "var(--font-body)", color: "text.secondary", fontWeight: 600 }}>Analysis</Typography>
        <SeeAllLink href="/analysis">All analysis</SeeAllLink>
      </Stack>
      <AnalysisList items={items} thumbSize={56} />
    </Paper>
  );
}
