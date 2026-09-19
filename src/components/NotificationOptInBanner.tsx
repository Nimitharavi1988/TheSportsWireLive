"use client";

import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CloseIcon from "@mui/icons-material/Close";

const DISMISSED_KEY = "sw-notif-banner-dismissed";

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))).buffer;
}

// Deliberately shown as its own dismissible banner rather than firing
// Notification.requestPermission() immediately on page load — an
// unprompted browser permission dialog on first visit is reflexively
// denied by most people and can't be re-asked once declined. This gives a
// visible reason first, same pattern as InstallAppBanner.tsx, and only
// renders at all once there's something to ask for (permission not already
// granted/denied, and the VAPID public key is actually configured).
export function NotificationOptInBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return; // already granted or denied — nothing to ask
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    setDismissed(false);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function subscribe() {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch {
      // Best-effort — a failed subscribe just means no notifications for
      // this visitor, not a broken page.
    } finally {
      dismiss();
      setSubscribing(false);
    }
  }

  if (dismissed) return null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, mb: 3, display: "flex", alignItems: "center", gap: 1.5, borderColor: "primary.main", bgcolor: "rgba(29, 107, 63, 0.05)" }}
    >
      <NotificationsActiveIcon sx={{ color: "primary.main" }} />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Get breaking news alerts</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          We'll only notify you for genuinely big stories — not every article.
        </Typography>
      </Stack>
      <Button variant="contained" size="small" onClick={subscribe} disabled={subscribing} sx={{ flexShrink: 0 }}>
        Enable
      </Button>
      <IconButton size="small" onClick={dismiss} aria-label="Dismiss">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}
