"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FacebookIcon from "@mui/icons-material/Facebook";
import { trackAppEvent } from "./appPrompts";

// Where Facebook visitors land is the article, not the home page, and the share and follow links used
// to sit at the bottom of it (ShareButtons, FollowUs). Two small pills under the breadcrumbs instead:
// follow the Page, share the story. English: the main Page; Spanish: the Spanish Page.
const MAIN_PAGE = "https://www.facebook.com/SportsWireLiveNews";
const SPANISH_PAGE = "https://www.facebook.com/1343775455488735";

export function FacebookActions({ url, locale }: { url: string; locale?: string }) {
  const es = locale === "es";
  const pill = {
    borderRadius: 5, textTransform: "none", fontWeight: 600, fontSize: 13, py: 0.25, px: 1.5, color: "#1877F2", borderColor: "divider", whiteSpace: "nowrap",
  } as const;
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
      <Button
        component="a" href={es ? SPANISH_PAGE : MAIN_PAGE} target="_blank" rel="noopener noreferrer" size="small" variant="outlined"
        startIcon={<FacebookIcon sx={{ fontSize: 18 }} />} sx={pill} onClick={() => trackAppEvent("fb_follow_clicked")}
      >
        {es ? "Seguir en Facebook" : "Follow on Facebook"}
      </Button>
      <Button
        component="a" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" size="small" variant="outlined"
        startIcon={<FacebookIcon sx={{ fontSize: 18 }} />} sx={pill} onClick={() => trackAppEvent("fb_share_clicked")}
      >
        {es ? "Compartir" : "Share"}
      </Button>
    </Box>
  );
}
