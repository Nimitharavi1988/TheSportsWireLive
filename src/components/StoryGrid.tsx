import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getDict } from "@/lib/i18n/dictionary";
import { categoryLabel } from "@/lib/i18n/helpers";
import { TeamCrest } from "./TeamCrest";
import { categoryChipStyle } from "@/lib/categoryDisplay";

export interface StoryGridItem {
  slug: string;
  title: string;
  category: string;
  publishedAt: Date | string | null;
  heroImageUrl: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  summary?: string | null;
  // Small label before the sport ("Analysis", "Preview").
  kicker?: string | null;
  // Last line: byline, or why it's in a feed ("Arsenal, Cricket").
  footer?: string | null;
}

const clamp = (lines: number) => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" as const, overflow: "hidden" });

// Photo on top (16:9), then kicker + sport, headline, summary and a footer
// line. Two crests stand in for a match without a photo; a sport-tinted
// panel for anything else.
function GridPhoto({ item }: { item: StoryGridItem }) {
  const chip = categoryChipStyle(item.category);
  return (
    <Box sx={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 1.5, overflow: "hidden", bgcolor: "grey.100" }}>
      {item.heroImageUrl ? (
        <Box
          component={Image}
          src={item.heroImageUrl}
          alt=""
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 380px"
          sx={{ objectFit: "cover", objectPosition: "top" }}
        />
      ) : item.homeCrestUrl || item.awayCrestUrl || (item.homeTeam && item.awayTeam) ? (
        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
          <TeamCrest name={item.homeTeam} crestUrl={item.homeCrestUrl} size={64} />
          <Box component="span" sx={{ fontWeight: 700, color: "text.disabled" }}>v</Box>
          <TeamCrest name={item.awayTeam} crestUrl={item.awayCrestUrl} size={64} />
        </Box>
      ) : (
        <Box sx={{ position: "absolute", inset: 0, bgcolor: chip.color, opacity: 0.15 }} />
      )}
    </Box>
  );
}

// The card grid used by the Analysis page and the For You feed — the same
// shape as the Videos grid: three across on desktop, two on tablets, one on
// phones. Was a narrow single-column list on the left, leaving half the
// page empty on desktop (2026-09-28).
export function StoryGrid({ items, locale }: { items: StoryGridItem[]; locale?: string }) {
  const t = getDict(locale);
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
        gap: { xs: 2.5, sm: 3 },
      }}
    >
      {items.map((item) => {
        const base = categoryChipStyle(item.category);
        const chip = locale ? { ...base, label: categoryLabel(item.category, t) } : base;
        const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(locale ? t.dateLocale : "en-US", { month: "short", day: "numeric" }) : null;
        return (
          <Link key={item.slug} href={`/article/${item.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <Box component="article" sx={{ "&:hover .story-grid-title": { color: "primary.main" } }}>
              <GridPhoto item={item} />
              <Typography variant="caption" component="p" sx={{ fontWeight: 700, mt: 1.25, mb: 0.25 }}>
                {item.kicker && <Box component="span" sx={{ color: "primary.main", mr: 1 }}>{item.kicker}</Box>}
                <Box component="span" sx={{ color: chip.color }}>{chip.label}</Box>
              </Typography>
              <Typography
                className="story-grid-title"
                component="h2"
                sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.1rem", lineHeight: 1.3, transition: "color 0.15s", ...clamp(3) }}
              >
                {item.title}
              </Typography>
              {item.summary && (
                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, ...clamp(2) }}>
                  {item.summary}
                </Typography>
              )}
              <Typography variant="caption" component="p" sx={{ color: "text.secondary", mt: 0.75 }}>
                {[item.footer, date].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
          </Link>
        );
      })}
    </Box>
  );
}
