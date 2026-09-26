import Link from "next/link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AnalysisList } from "./AnalysisList";
import { fetchAnalysis } from "@/lib/analysis";

// The latest pieces by the site's own writers, on the home page (and a
// sport's page, for that sport). Renders nothing until there are some.
export async function AnalysisStrip({ category }: { category?: string }) {
  const items = await fetchAnalysis({ category, limit: 3 }).catch(() => []);
  if (items.length === 0) return null;
  return (
    <Paper component="section" aria-label="Analysis" variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>Analysis</Typography>
        <Link href="/analysis" style={{ fontSize: 14, fontWeight: 600 }}>All analysis →</Link>
      </Stack>
      <AnalysisList items={items} thumbSize={72} />
    </Paper>
  );
}
