"use client";

import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import CloseIcon from "@mui/icons-material/Close";
import { trackAppEvent } from "./appPrompts";

const DISMISSED = "swl-inapp-tip-dismissed";

// Facebook/Instagram open links in their own in-app browser, which can't
// install a home-screen app or ask for push permission -- so the usual
// install/alerts prompts never appear for most social visitors. This is the
// one thing that works there: a nudge to open the page in the real browser.
export function InAppBrowserTip() {
  const [kind, setKind] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {}
    const ua = navigator.userAgent;
    if (!/FBAN|FBAV|FB_IAB|FBIOS|Instagram/i.test(ua)) return;
    setKind(/android/i.test(ua) ? "android" : "ios");
    trackAppEvent("inapp_browser_tip_shown");
  }, []);

  if (!kind) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
    setKind(null);
  }

  function openInChrome() {
    trackAppEvent("inapp_browser_tip_clicked", false);
    const { host, pathname, search } = window.location;
    window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
  }

  return (
    <Paper
      variant="outlined"
      sx={{ py: 0.5, pl: 1.5, pr: 0.5, my: 2, display: "flex", alignItems: "center", gap: 1, borderRadius: 2, borderColor: "divider", bgcolor: "action.hover" }}
    >
      <OpenInBrowserIcon sx={{ color: "primary.main", fontSize: 20 }} />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>Open in your browser</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.3 }}>
          {kind === "android"
            ? "For live alerts and the app."
            : "Tap ⋯ then “Open in Safari” for alerts and the app."}
        </Typography>
      </Stack>
      {kind === "android" && (
        <Button variant="text" size="small" onClick={openInChrome} sx={{ flexShrink: 0, fontWeight: 700, textTransform: "none" }}>
          Open
        </Button>
      )}
      <IconButton size="small" onClick={dismiss} aria-label="Dismiss">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}
