import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ArticleThumb } from "./ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { relativeTime } from "@/lib/relativeTime";

// Compact list row (thumbnail, headline, one meta line) for dense result
// lists — search results and the For You feed. The way BBC Sport and
// Google News list results: a divider between rows instead of a bordered
// card per story, and the sport as colored text rather than a chip.
export function ArticleRow({
  article,
  summary,
  context,
}: {
  article: {
    slug: string;
    title: string;
    category: string;
    publishedAt: Date | string | null;
    heroImageUrl: string | null;
    homeCrestUrl: string | null;
    awayCrestUrl: string | null;
    heroImageCredit?: string | null;
    heroImageCreditUrl?: string | null;
  };
  summary?: string | null;
  // Extra meta, e.g. which followed team matched ("Arsenal").
  context?: string | null;
}) {
  const chip = categoryChipStyle(article.category);
  const published = article.publishedAt ? new Date(article.publishedAt) : null;
  // A plain <Link> wrapper (not Box component={Link}) — this renders in
  // server components, which can't pass a component function to MUI.
  return (
    <Link href={`/article/${article.slug}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          py: 1.75,
          borderBottom: "1px solid",
          borderColor: "divider",
          "&:hover .article-row-title": { color: "primary.main" },
        }}
      >
        <ArticleThumb article={article} size={72} fallbackColor={chip.color} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            className="article-row-title"
            component="h2"
            sx={{
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.35,
              transition: "color 0.15s",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.title}
          </Typography>
          {summary && (
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mt: 0.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {summary}
            </Typography>
          )}
          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
            <Box component="span" sx={{ color: chip.color, fontWeight: 600 }}>{chip.label}</Box>
            {context && ` · ${context}`}
            {published && ` · ${relativeTime(published)}`}
          </Typography>
        </Box>
      </Box>
    </Link>
  );
}
