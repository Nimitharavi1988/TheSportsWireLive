"use client";

import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import CloseIcon from "@mui/icons-material/Close";

const DISMISSED_KEY = "sw-install-banner-dismissed";

// Chrome/Android/desktop fire `beforeinstallprompt` and let a page trigger
// the native install dialog programmatically — but only if the page asks;
// browsers don't surface that prompt on their own for most visitors, so
// this banner is what actually gets the PWA (manifest.ts + sw.js) installed
// rather than just theoretically installable. iOS Safari never fires this
// event at all (no programmatic install exists there), so it gets
// instructions instead of a broken button.
export function InstallAppBanner() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default hidden until checks below confirm it's worth showing

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return; // already installed

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(ios);

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e);
      setDismissed(false);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // iOS never fires beforeinstallprompt, so show the instructional
    // version there directly instead of waiting for an event that'll
    // never come.
    if (ios) setDismissed(false);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    dismiss();
  }

  if (dismissed) return null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, mb: 3, display: "flex", alignItems: "center", gap: 1.5, borderColor: "primary.main", bgcolor: "rgba(29, 107, 63, 0.05)" }}
    >
      <InstallMobileIcon sx={{ color: "primary.main" }} />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Get the app</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {isIos
            ? "Tap the Share button, then \"Add to Home Screen\"."
            : "Install Sports Wire Live for quick access and a full-screen feel."}
        </Typography>
      </Stack>
      {!isIos && (
        <Button variant="contained" size="small" onClick={install} sx={{ flexShrink: 0 }}>
          Install
        </Button>
      )}
      <IconButton size="small" onClick={dismiss} aria-label="Dismiss">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}
