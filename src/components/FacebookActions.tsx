"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FacebookIcon from "@mui/icons-material/Facebook";
import { trackAppEvent } from "./appPrompts";

// Where Facebook visitors land is the article, not the home page, and the share and follow links used
// to sit at the bottom of it (ShareButtons, FollowUs). Two small pills near the top instead, in the same
// outlined style as the For You pill (theme colours, not Facebook blue), on one row with it so the
// page doesn't grow. English: the main Page; Spanish: the Spanish Page.
const MAIN_PAGE = "https://www.facebook.com/SportsWireLiveNews";
const SPANISH_PAGE = "https://www.facebook.com/1343775455488735";

export function FacebookActions({ url, locale }: { url: string; locale?: string }) {
  const es = locale === "es";
  const pill = { borderRadius: 5, textTransform: "none", fontWeight: 600, fontSize: 13, py: 0.25, px: 1.5, whiteSpace: "nowrap" } as const;
  return (
    <>
      <Button
        component="a" href={es ? SPANISH_PAGE : MAIN_PAGE} target="_blank" rel="noopener noreferrer" size="small" variant="outlined" color="primary"
        startIcon={<FacebookIcon sx={{ fontSize: 18 }} />} sx={pill} onClick={() => trackAppEvent("fb_follow_clicked")}
      >
        {es ? "Seguir" : "Follow us"}
      </Button>
      <Button
        component="a" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" size="small" variant="outlined" color="primary"
        startIcon={<FacebookIcon sx={{ fontSize: 18 }} />} sx={pill} onClick={() => trackAppEvent("fb_share_clicked")}
      >
        {es ? "Compartir" : "Share"}
      </Button>
    </>
  );
}

// One slim row for the article page: the For You pill and the two Facebook pills together.
export function ArticleActionsRow({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>{children}</Box>;
}
