import Box from "@mui/material/Box";

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
  article: { heroImageUrl: string | null; homeCrestUrl: string | null; awayCrestUrl: string | null };
  size?: number;
  fallbackColor?: string;
}) {
  if (article.heroImageUrl) {
    return (
      <Box
        component="img"
        src={article.heroImageUrl}
        alt=""
        sx={{ width: size, height: size, borderRadius: 1.5, objectFit: "cover", objectPosition: "top", flexShrink: 0 }}
      />
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
