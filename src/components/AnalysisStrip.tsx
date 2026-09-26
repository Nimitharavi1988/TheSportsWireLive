import Link from "next/link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AnalysisList } from "./AnalysisList";
import { fetchAnalysis } from "@/lib/analysis";

// From this many pieces the strip leads the page ("top"); with fewer it sits
// at the bottom of the right-hand column ("side"), so a handful of stories
// don't take the prime spot. Both placements are rendered; each shows only
// in its own case.
export const ANALYSIS_TOP_MIN = 6;
const SHOWN = 3;

// The latest pieces by the site's own writers, on the home page (and a
// sport's page, for that sport). Renders nothing until there are some.
export async function AnalysisStrip({ category, placement }: { category?: string; placement: "top" | "side" }) {
  const items = await fetchAnalysis({ category, limit: ANALYSIS_TOP_MIN }).catch(() => []);
  const leads = items.length >= ANALYSIS_TOP_MIN;
  if (items.length === 0 || leads !== (placement === "top")) return null;
  return (
    <Paper component="section" aria-label="Analysis" variant="outlined" sx={placement === "top" ? { p: 2.5, mb: 3 } : { p: 2.5, mt: 3 }}>
      <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>Analysis</Typography>
        <Link href="/analysis" style={{ fontSize: 14, fontWeight: 600 }}>All analysis →</Link>
      </Stack>
      <AnalysisList items={items.slice(0, SHOWN)} thumbSize={placement === "top" ? 72 : 56} />
    </Paper>
  );
}
