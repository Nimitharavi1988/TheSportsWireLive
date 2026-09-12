"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { crestAltText } from "@/lib/teamNames";

export interface HeroSlideData {
  slug: string;
  title: string;
  summary: string;
  heroImageUrl: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  bannerUrl: string | null;
  bannerCredit: string | null;
  bannerCreditUrl: string | null;
}

const AUTO_ADVANCE_MS = 8000;

export function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Auto-advance can leave `index` pointing past the end if the slide count
  // ever shrinks between renders (e.g. a category filter changes) — guard
  // rather than let a stale index read undefined.
  const safeIndex = index % slides.length;

  if (slides.length === 0) return null;
  const slide = slides[safeIndex];

  function go(delta: number) {
    setIndex((i) => (i + delta + slides.length) % slides.length);
  }

  const hasCrests = Boolean(slide.homeCrestUrl && slide.awayCrestUrl);
  const imageUrl = slide.bannerUrl ?? slide.heroImageUrl;

  return (
    <Box sx={{ position: "relative", mb: 4 }}>
      <Card variant="outlined" sx={{ borderColor: "primary.main", borderWidth: 2 }}>
        {imageUrl ? (
          // Photo-driven hero (editorial/RSS stories): headline overlaid
          // directly on the image with a gradient scrim, the way most news
          // front pages treat a lead story.
          <Box sx={{ position: "relative" }}>
            <Box
              component="img"
              src={imageUrl}
              alt={slide.title}
              sx={{ width: "100%", height: 460, objectFit: "cover", objectPosition: "top", display: "block" }}
            />
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0) 75%)",
              }}
            />
            <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: 3 }}>
              <Chip
                label="Top Story"
                size="small"
                sx={{ bgcolor: "primary.main", color: "primary.contrastText", fontWeight: 700, mb: 1.5 }}
              />
              <Link href={`/article/${slide.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                <Typography variant="h4" component="h2" gutterBottom sx={{ color: "#fff" }}>
                  {slide.title}
                </Typography>
                <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.88)" }}>
                  {slide.summary}
                </Typography>
              </Link>
            </Box>
            {slide.bannerCredit && (
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: 10,
                  right: 12,
                  color: "rgba(255,255,255,0.85)",
                  bgcolor: "rgba(0,0,0,0.35)",
                  borderRadius: 1,
                  px: 1,
                  py: 0.25,
                }}
              >
                <a href={slide.bannerCreditUrl ?? undefined} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                  {slide.bannerCredit}
                </a>
              </Typography>
            )}
          </Box>
        ) : (
          // Crest-based match hero (no single dominant photo) — the two team
          // crests carry the visual weight instead, on a brand-tinted band.
          // minHeight matches the photo slide's fixed 460px image height and
          // centers this shorter content within it, so the card doesn't
          // visibly shrink/grow as the carousel rotates between slide types
          // (measured live: was jumping between ~349px and ~464px).
          <Box sx={{ minHeight: 460, display: "flex", flexDirection: "column" }}>
            {hasCrests && (
              <Stack
                direction="row"
                spacing={2.5}
                sx={{
                  alignItems: "center",
                  justifyContent: "center",
                  py: 3,
                  bgcolor: "rgba(29, 107, 63, 0.05)",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <img src={slide.homeCrestUrl!} alt={crestAltText(slide.summary).home} width={96} height={96} />
                <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 600 }}>
                  vs
                </Typography>
                <img src={slide.awayCrestUrl!} alt={crestAltText(slide.summary).away} width={96} height={96} />
              </Stack>
            )}
            {/* mt: "auto" pins this to the bottom of the card regardless of
                how short the crest row above is — matching the photo
                variant's bottom-anchored text overlay instead of the whole
                block just sitting vertically centered as one unit. */}
            <CardContent sx={{ p: 3, mt: "auto" }}>
              <Chip label="Top Story" size="small" sx={{ color: "primary", mb: 1 }} />
              <Link href={`/article/${slide.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                <Typography variant="h4" component="h2" gutterBottom>
                  {slide.title}
                </Typography>
                <Typography variant="body1" sx={{ color: "text.secondary" }}>
                  {slide.summary}
                </Typography>
              </Link>
            </CardContent>
          </Box>
        )}
      </Card>

      {slides.length > 1 && (
        <>
          <IconButton
            onClick={() => go(-1)}
            aria-label="Previous top story"
            sx={{
              position: "absolute",
              left: 8,
              top: imageUrl ? 210 : "50%",
              transform: "translateY(-50%)",
              bgcolor: "rgba(0,0,0,0.35)",
              color: "#fff",
              "&:hover": { bgcolor: "rgba(0,0,0,0.55)" },
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            onClick={() => go(1)}
            aria-label="Next top story"
            sx={{
              position: "absolute",
              right: 8,
              top: imageUrl ? 210 : "50%",
              transform: "translateY(-50%)",
              bgcolor: "rgba(0,0,0,0.35)",
              color: "#fff",
              "&:hover": { bgcolor: "rgba(0,0,0,0.55)" },
            }}
          >
            <ChevronRightIcon />
          </IconButton>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              position: "absolute",
              bottom: imageUrl ? 12 : -20,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            {slides.map((s, i) => (
              <Box
                key={s.slug}
                onClick={() => setIndex(i)}
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  cursor: "pointer",
                  bgcolor: i === safeIndex ? (imageUrl ? "#fff" : "primary.main") : imageUrl ? "rgba(255,255,255,0.5)" : "divider",
                  transition: "background-color 0.2s",
                }}
              />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
