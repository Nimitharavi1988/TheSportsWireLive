import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { isHeroQualityImage } from "@/lib/imageQuality";
import { relativeTime } from "@/lib/relativeTime";

export type UpNextArticle = {
  slug: string;
  title: string;
  category: string;
  publishedAt: Date | null;
  heroImageUrl: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
};

// One large "Up next" story straight after the article body — the point
// where a reader decides to stay or leave (BBC Sport/ESPN/The Athletic all
// put their next-story prompt here, not at the page bottom). Full-width
// photo when the story has a proper one (same bar as the hero), otherwise
// a compact row with the usual thumbnail. The whole card is the link.
export function UpNextCard({ article }: { article: UpNextArticle }) {
  const chip = categoryChipStyle(article.category);
  const bigImage = isHeroQualityImage(article.heroImageUrl);
  return (
    <Box component="section" aria-label="Up next" sx={{ mb: 3 }}>
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <Paper
          variant="outlined"
          sx={{
            overflow: "hidden",
            borderColor: "primary.main",
            transition: "box-shadow 0.15s",
            "&:hover": { boxShadow: 2 },
            "&:hover .up-next-title": { color: "primary.main" },
          }}
        >
          {bigImage && article.heroImageUrl && (
            <Box sx={{ position: "relative", aspectRatio: "16 / 9", bgcolor: "action.hover" }}>
              <Image src={article.heroImageUrl} alt="" fill sizes="(max-width: 900px) 100vw, 720px" style={{ objectFit: "cover" }} />
            </Box>
          )}
          <Stack direction="row" spacing={1.5} sx={{ p: 2, alignItems: "center" }}>
            {!bigImage && <ArticleThumb article={article} size={64} fallbackColor={chip.color} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 700, lineHeight: 1.2 }}>
                  Up next
                </Typography>
                <Typography variant="caption" sx={{ color: chip.color, fontWeight: 700 }}>
                  {chip.label}
                </Typography>
                {article.publishedAt && (
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    · {relativeTime(article.publishedAt)}
                  </Typography>
                )}
              </Stack>
              <Typography className="up-next-title" variant="h6" component="h2" sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: { xs: "1.05rem", sm: "1.2rem" } }}>
                {article.title}
              </Typography>
            </Box>
            <ArrowForwardIcon sx={{ color: "primary.main", flexShrink: 0 }} />
          </Stack>
        </Paper>
      </Link>
    </Box>
  );
}
