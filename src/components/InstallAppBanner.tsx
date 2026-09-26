"use client";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import CloseIcon from "@mui/icons-material/Close";

import { dismissInstall, useAppPrompts } from "./appPrompts";

// Chrome/Android/desktop fire `beforeinstallprompt` and let a page trigger
// the native install dialog programmatically — but only if the page asks;
// browsers don't surface that prompt on their own for most visitors, so
// this banner is what actually gets the PWA (manifest.ts + sw.js) installed
// rather than just theoretically installable. iOS Safari never fires this
// event at all (no programmatic install exists there), so it gets
// instructions instead of a broken button.
// Install prompt: shown only while the browser offers an install (or on
// iOS, with the Add to Home Screen hint). Visibility comes from the shared
// per-visit state in appPrompts.ts — see there for why.
export function InstallAppBanner() {
  const { install: status, installEvent } = useAppPrompts();
  const isIos = status === "ios";

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    dismissInstall();
  }

  if (status !== "available" && status !== "ios") return null;

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
      <IconButton size="small" onClick={dismissInstall} aria-label="Dismiss">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}
