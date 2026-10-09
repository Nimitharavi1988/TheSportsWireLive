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
import { useDict } from "@/lib/i18n/LocaleContext";
import { FOLLOWS_COOKIE } from "@/lib/follows";
import { FAVORITE_SPORTS_COOKIE } from "@/lib/preferences";

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

// Runs while the HTML is parsed, before the strip paints: marks <html> when
// this visitor dismissed the strip or already follows something, and CSS
// hides the strip. It used to appear only after hydration — the page's
// whole layout shift (CLS 0.08-0.1 in PageSpeed, 2026-09-27), everything
// below it jumping 129px on phones.
const HIDE_BEFORE_PAINT = `try{if(localStorage.getItem(${JSON.stringify(DISMISSED_KEY)})||localStorage.getItem(${JSON.stringify(LEGACY_DISMISSED_KEY)})||/(^|; )(${FOLLOWS_COOKIE}|${FAVORITE_SPORTS_COOKIE})=[^;]/.test(document.cookie))document.documentElement.dataset.foryou="hide"}catch(e){}`;

// Homepage entry point to For You, replacing MyFeedPicker's inline picker
// card. Only a one-line, dismissible invitation for visitors who follow
// nothing yet — once they follow something, the "For You" nav item is the
// way in, so the homepage doesn't repeat their feed (an earlier version
// showed a preview of it here; removed as a duplicate of the nav page).
// Rendered on the server (most visitors see it), hidden before paint for
// the rest (HIDE_BEFORE_PAINT), then removed once the browser check runs.
export function ForYouStrip() {
  const t = useDict().forYou;
  const { follows, ready } = useFollows();
  const storedDismissed = useSyncExternalStore(subscribeStorage, readDismissed, () => false);
  const [dismissedNow, setDismissedNow] = useState(false);

  if ((ready && follows.length > 0) || storedDismissed || dismissedNow) return null;

  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: HIDE_BEFORE_PAINT }} />
    <Box
      sx={{
        "html[data-foryou='hide'] &": { display: "none" },
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
        {t.stripBefore}<b>{t.stripBold}</b>{t.stripAfter}
      </Typography>
      <Button component={Link} href="/for-you" size="small" variant="outlined" sx={{ borderRadius: 5, textTransform: "none", fontWeight: 600, flexShrink: 0 }}>
        {t.getStarted}
      </Button>
      <IconButton
        size="small"
        aria-label={t.dismiss}
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
    </>
  );
}
