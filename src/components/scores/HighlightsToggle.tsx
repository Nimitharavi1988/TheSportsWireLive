"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import SmartDisplayIcon from "@mui/icons-material/SmartDisplay";
import { VideoPlayer } from "@/components/videos/VideoPlayer";

// "Watch highlights" under a finished match's row. Collapsed by default so
// no video code loads with the board; opening shows VideoPlayer's
// click-to-play facade (the YouTube iframe only loads on play).
export function HighlightsToggle({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ px: 2, pb: open ? 1.5 : 0.75 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, border: 0, p: 0, bgcolor: "transparent", font: "inherit", fontSize: 12, fontWeight: 600, color: "primary.main", cursor: "pointer" }}
      >
        <SmartDisplayIcon sx={{ fontSize: 16, color: "error.main" }} />
        {open ? "Hide highlights" : "Watch highlights"}
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ mt: 1 }}>
          <VideoPlayer youtubeId={youtubeId} title={title} sizes="(max-width: 900px) 100vw, 480px" />
        </Box>
      </Collapse>
    </Box>
  );
}
