import { TeamCrest } from "@/components/TeamCrest";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Image from "next/image";

// Below this, a credit caption doesn't fit legibly — the row-icon-sized
// avatars (40/48px) this component is mostly used at have no room for
// readable text without the badge outsizing the image itself. Article and
// hero pages already carry full attribution for those; only the larger
// standalone thumbnails (Transfers & Big News, Match Results & Previews)
// need this.
const MIN_SIZE_FOR_CREDIT = 64;

// Shared small-thumbnail treatment for list-style sections (By Category,
// Just In, Also in the News, related articles) — a real image when one
// exists, else the two team crests for a match article, else a plain
// colored placeholder. Keeps these visually consistent instead of some rows
// having thumbnails and others being plain text. No "use client" needed —
// purely presentational, safe in Server Components.
//
// 3:2, not a square — was a perfect 1:1 square, which forced every wide
// press photo into a much narrower crop than it was shot at. Confirmed
// live 2026-09-21: Hindustan Times serves every photo at a fixed 1600x900
// (16:9) crop, so squeezing that into a 1:1 square cropped away roughly
// 44% of the image's width, reading as "zoomed in" on whatever was
// centered — most visible on HT specifically because their images are
// uniformly wide every time, but the same math applies to any wide source
// photo. `size` is still the prop every call site passes and still governs
// the row height (unchanged), width is now derived from it.
const THUMB_ASPECT_RATIO = 1.5; // width : height

export function ArticleThumb({
  article,
  size = 40,
  fallbackColor = "#6b6b6b",
}: {
  article: {
    heroImageUrl: string | null;
    homeCrestUrl: string | null;
    awayCrestUrl: string | null;
    homeTeam?: string | null;
    awayTeam?: string | null;
    heroImageCredit?: string | null;
    heroImageCreditUrl?: string | null;
  };
  size?: number;
  fallbackColor?: string;
}) {
  const width = Math.round(size * THUMB_ASPECT_RATIO);
  if (article.heroImageUrl) {
    const showCredit = size >= MIN_SIZE_FOR_CREDIT && article.heroImageCredit;
    return (
      <Box sx={{ position: "relative", width, height: size, flexShrink: 0 }}>
        <Box
          component={Image}
          src={article.heroImageUrl}
          alt=""
          fill
          sizes={`${width}px`}
          sx={{ borderRadius: 1.5, objectFit: "cover", objectPosition: "top" }}
        />
        {showCredit && (
          // Same syndication-credit requirement the hero and article page
          // already honor (see schema comment on Article.heroImageCredit).
          // Deliberately near-invisible — no background pill, just a
          // text-shadow for legibility, so it doesn't read as a heavy badge
          // on such a small thumbnail.
          //
          // Plain text, NOT a nested <a> — every real usage of this
          // component (player/club/series pages) wraps the whole card in
          // its own <Link> to the article. A second <a> inside that is
          // invalid HTML and was causing a real hydration crash that broke
          // those pages outright (confirmed live: "<a> cannot contain a
          // nested <a>"). Attribution requires visible credit text, not
          // that the credit itself be clickable — the source is still
          // reachable from the article/hero page's own credit link.
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              right: 3,
              bottom: 3,
              color: "rgba(255,255,255,0.4)",
              fontSize: 8,
              lineHeight: 1.4,
              textShadow: "0 1px 1px rgba(0,0,0,0.5)",
              maxWidth: "calc(100% - 6px)",
            }}
            noWrap
          >
            {article.heroImageCredit}
          </Typography>
        )}
      </Box>
    );
  }
  if (article.homeCrestUrl && article.awayCrestUrl) {
    return (
      <Box
        sx={{
          width,
          height: size,
          borderRadius: 1.5,
          flexShrink: 0,
          bgcolor: "rgba(29, 107, 63, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.25,
        }}
      >
        <TeamCrest name={article.homeTeam} crestUrl={article.homeCrestUrl} size={Math.round(size * 0.38)} />
        <TeamCrest name={article.awayTeam} crestUrl={article.awayCrestUrl} size={Math.round(size * 0.38)} />
      </Box>
    );
  }
  return (
    <Box
      sx={{
        width,
        height: size,
        borderRadius: 1.5,
        flexShrink: 0,
        bgcolor: fallbackColor,
        opacity: 0.15,
      }}
    />
  );
}
