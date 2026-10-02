import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary } from "@/lib/articleSummary";
import { getDict } from "@/lib/i18n/dictionary";
import { categoryLabel, formatShortDate } from "@/lib/i18n/helpers";

export type StoryCardArticle = Parameters<typeof displaySummary>[0] & {
  slug: string;
  title: string;
  category: string;
  publishedAt: Date | null;
  highlighted?: boolean;
  heroImageUrl: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  heroImageCredit?: string | null;
  heroImageCreditUrl?: string | null;
};

const clamp = (lines: number) => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" as const, overflow: "hidden" });

// One story in a home-page list (Transfers & Big News, Match Results &
// Previews, NFL Scores & Previews) — was the same card hand-built three
// times. Phones: sport + date on top, then a small photo beside a headline
// of at most 3 lines, top-aligned (was a centred 126px photo beside a
// 5-line, 20px headline, with empty space around the photo and its credit
// text over the picture). Wider screens: larger photo, the summary capped
// at 2 lines so cards keep an even height.
// accent: border colour (a theme token such as "warning.main" is fine).
// locale (e.g. "es"): a language edition renders the same card with that
// language's sport label and date; `article` then carries the translated
// title/body, and the link is the same /article/<slug> path (each edition's host
// serves it from its own tree).
export function StoryCard({ article, accent, showSummary = false, locale = "en" }: { article: StoryCardArticle; accent?: string; showSummary?: boolean; locale?: string }) {
  const t = getDict(locale);
  const base = categoryChipStyle(article.category);
  const chip = locale ? { ...base, label: categoryLabel(article.category, t) } : base;
  const meta = (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
      <Chip label={chip.label} size="small" variant="outlined" sx={{ color: chip.color, borderColor: chip.color, fontWeight: 600 }} />
      {article.highlighted && <Chip label={t.home.editorsPick} size="small" sx={{ color: "warning.contrastText", bgcolor: "warning.main" }} />}
      {article.publishedAt && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {locale ? formatShortDate(article.publishedAt, t) : article.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Typography>
      )}
    </Stack>
  );

  return (
    <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Card
        variant="outlined"
        sx={{
          ...(accent ? { borderColor: accent } : {}),
          p: { xs: 1.5, sm: 2 },
          transition: "box-shadow 0.15s, border-color 0.15s, transform 0.15s",
          "&:hover": { borderColor: accent ?? "primary.main", boxShadow: "0 4px 14px rgba(0,0,0,0.1)", transform: "translateY(-2px)" },
          "&:hover .story-card-title": { color: "primary.main" },
        }}
      >
        <Box sx={{ display: { xs: "block", sm: "none" }, mb: 1 }}>{meta}</Box>
        <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} sx={{ alignItems: "flex-start" }}>
          <Box sx={{ display: { xs: "block", sm: "none" }, flexShrink: 0 }}>
            <ArticleThumb article={article} size={60} fallbackColor={chip.color} />
          </Box>
          <Box sx={{ display: { xs: "none", sm: "block" }, flexShrink: 0 }}>
            <ArticleThumb article={article} size={84} fallbackColor={chip.color} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: { xs: "none", sm: "block" }, mb: 1 }}>{meta}</Box>
            <Typography
              className="story-card-title"
              component="h2"
              sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, lineHeight: 1.3, fontSize: { xs: "1rem", sm: "1.15rem" }, transition: "color 0.15s", ...clamp(3) }}
            >
              {article.title}
            </Typography>
            {showSummary && (
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75, display: { xs: "none", sm: "-webkit-box" }, WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {displaySummary(article)}
              </Typography>
            )}
          </Box>
        </Stack>
      </Card>
    </Link>
  );
}
