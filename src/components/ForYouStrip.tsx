"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useFollows } from "./useFollows";

const DISMISSED_KEY = "swl_foryou_prompt_dismissed";
// The old My Feed prompt's dismissal — honored so anyone who already
// closed that prompt isn't asked again under the new name.
const LEGACY_DISMISSED_KEY = "sw-myfeed-dismissed";

function readDismissed(): boolean {
  try {
    return Boolean(localStorage.getItem(DISMISSED_KEY) ?? localStorage.getItem(LEGACY_DISMISSED_KEY));
  } catch {
    return false;
  }
}

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

// Homepage entry point to For You, replacing MyFeedPicker's inline picker
// card. Only a one-line, dismissible invitation for visitors who follow
// nothing yet — once they follow something, the "For You" nav item is the
// way in, so the homepage doesn't repeat their feed (an earlier version
// showed a preview of it here; removed as a duplicate of the nav page).
export function ForYouStrip() {
  const { follows, ready } = useFollows();
  // Server snapshot is "dismissed" so nothing renders before the browser check.
  const storedDismissed = useSyncExternalStore(subscribeStorage, readDismissed, () => true);
  const [dismissedNow, setDismissedNow] = useState(false);

  if (!ready || follows.length > 0 || storedDismissed || dismissedNow) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.25,
        mb: 3,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <StarBorderIcon sx={{ color: "primary.main", fontSize: 22 }} />
      <Typography sx={{ flex: 1, fontSize: 14 }}>
        Follow your teams and players to get a <b>For You</b> feed of just their news.
      </Typography>
      <Button component={Link} href="/for-you" size="small" variant="contained" disableElevation sx={{ borderRadius: 5, textTransform: "none", fontWeight: 600, flexShrink: 0 }}>
        Get started
      </Button>
      <IconButton
        size="small"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED_KEY, "1");
          } catch {}
          setDismissedNow(true);
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
