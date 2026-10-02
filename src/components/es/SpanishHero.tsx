import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { StoryCard } from "@/components/StoryCard";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary } from "@/lib/articleSummary";
import { ES, categoryLabelEs, formatDateEs } from "@/lib/i18n/es";
import type { SpanishStory } from "@/lib/i18n/spanishArticles";

// Featured story at the top of the Spanish home page: one large lead with a
// real photo, plus a short column of the next stories. Light and simple, same
// treatment as the English home's lead (see HeroCarousel) without the carousel.
export function SpanishHero({ lead, side }: { lead: SpanishStory; side: SpanishStory[] }) {
  const chip = categoryChipStyle(lead.category);
  return (
    <Box component="section" aria-label={ES.home.topStory} sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(0, 1fr)" }, mb: 5 }}>
      <Link href={`/article/${lead.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", "&:hover .hero-title": { color: "primary.main" } }}>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "16 / 9", bgcolor: "action.hover" }}>
          <Image src={lead.heroImageUrl!} alt={lead.title} fill priority fetchPriority="high" sizes="(max-width: 900px) 100vw, 700px" style={{ objectFit: "cover", objectPosition: "center 20%" }} />
        </Box>
        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <Chip label={categoryLabelEs(lead.category)} size="small" variant="outlined" sx={{ color: chip.color, borderColor: chip.color, fontWeight: 600 }} />
            {lead.publishedAt && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {formatDateEs(lead.publishedAt)}
              </Typography>
            )}
          </Stack>
          <Typography className="hero-title" component="h2" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, lineHeight: 1.2, fontSize: { xs: "1.4rem", sm: "1.8rem" }, transition: "color 0.15s" }}>
            {lead.title}
          </Typography>
          <Typography sx={{ color: "text.secondary", mt: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {displaySummary(lead, 220)}
          </Typography>
        </Box>
      </Box>
      </Link>
      {side.length > 0 && (
        <Stack spacing={1.5}>
          {side.map((a) => (
            <StoryCard key={a.id} article={{ ...a, highlighted: false }} locale="es" />
          ))}
        </Stack>
      )}
    </Box>
  );
}
