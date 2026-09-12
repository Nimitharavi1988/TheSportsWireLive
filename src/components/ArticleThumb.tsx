import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

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
export function ArticleThumb({
  article,
  size = 40,
  fallbackColor = "#6b6b6b",
}: {
  article: {
    heroImageUrl: string | null;
    homeCrestUrl: string | null;
    awayCrestUrl: string | null;
    heroImageCredit?: string | null;
    heroImageCreditUrl?: string | null;
  };
  size?: number;
  fallbackColor?: string;
}) {
  if (article.heroImageUrl) {
    const showCredit = size >= MIN_SIZE_FOR_CREDIT && article.heroImageCredit;
    return (
      <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <Box
          component="img"
          src={article.heroImageUrl}
          alt=""
          sx={{ width: size, height: size, borderRadius: 1.5, objectFit: "cover", objectPosition: "top", display: "block" }}
        />
        {showCredit && (
          // Same syndication-credit requirement the hero and article page
          // already honor (see schema comment on Article.heroImageCredit).
          // Deliberately near-invisible — no background pill, just a
          // text-shadow for legibility, so it doesn't read as a heavy badge
          // on such a small thumbnail.
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
              transition: "color 0.15s",
              "&:hover": { color: "rgba(255,255,255,0.85)" },
            }}
            noWrap
          >
            {article.heroImageCreditUrl ? (
              <a href={article.heroImageCreditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                {article.heroImageCredit}
              </a>
            ) : (
              article.heroImageCredit
            )}
          </Typography>
        )}
      </Box>
    );
  }
  if (article.homeCrestUrl && article.awayCrestUrl) {
    return (
      <Box
        sx={{
          width: size,
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
        <img src={article.homeCrestUrl} alt="" width={size * 0.38} height={size * 0.38} />
        <img src={article.awayCrestUrl} alt="" width={size * 0.38} height={size * 0.38} />
      </Box>
    );
  }
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1.5,
        flexShrink: 0,
        bgcolor: fallbackColor,
        opacity: 0.15,
      }}
    />
  );
}
