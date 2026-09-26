import Link from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { storyKindLabel } from "@/lib/stories";
import type { AnalysisItem } from "@/lib/analysis";

// One row per original story: photo, kind + sport, headline, byline + date.
// Used by the Analysis page and the home page strip.
export function AnalysisList({ items, thumbSize = 88, showSummary = false }: { items: AnalysisItem[]; thumbSize?: number; showSummary?: boolean }) {
  return (
    <Stack spacing={2}>
      {items.map((s) => {
        const chip = categoryChipStyle(s.category);
        return (
          <Link key={s.slug} href={`/article/${s.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", "&:hover .analysis-title": { color: "primary.main" } }}>
              <ArticleThumb article={s} size={thumbSize} fallbackColor={chip.color} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main" }}>
                  {storyKindLabel(s.storyKind) ?? "Analysis"}
                  <Box component="span" sx={{ color: chip.color, ml: 1 }}>{chip.label}</Box>
                </Typography>
                <Typography className="analysis-title" sx={{ fontWeight: 700, lineHeight: 1.35 }}>{s.title}</Typography>
                {showSummary && (
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, display: { xs: "none", sm: "block" } }}>{s.summary}</Typography>
                )}
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {s.authorName ? `By ${s.authorName}` : "Sports Wire Live"}
                  {s.publishedAt ? ` · ${s.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                </Typography>
              </Box>
            </Stack>
          </Link>
        );
      })}
    </Stack>
  );
}
