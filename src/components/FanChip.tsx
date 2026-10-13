"use client";

import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import Box from "@mui/material/Box";
import { trackAppEvent } from "./appPrompts";
import { FAN_STORAGE_KEY, FAN_UPDATED_EVENT } from "./FanBeacon";

interface FanChipData {
  streak: number;
  days: number;
  tier: string | null;
}

function subscribe(onChange: () => void) {
  window.addEventListener(FAN_UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(FAN_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(FAN_STORAGE_KEY);
  } catch {
    return null;
  }
}

// Header chip linking to the visitor's fan card. Everyone sees it (it used to appear only after a
// 2-day streak, so the 1,600 new visitors a day never saw a way in: 1 opened the card on 12 Oct
// 2026): "Fan card" until they have a streak, then their streak. Reads the summary FanBeacon last
// stored. Rendered on the server too, so the header does not shift when it appears.
export function FanChip() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const data = useMemo<FanChipData | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as FanChipData;
    } catch {
      return null;
    }
  }, [raw]);

  const streak = data && data.streak >= 2 ? data.streak : 0;
  // Counted once per session, so the click rate (fan_chip_clicked / fan_chip_shown) can be read.
  useEffect(() => { trackAppEvent("fan_chip_shown"); }, []);
  return (
    <Box
      component={Link}
      href="/fan-card"
      onClick={() => trackAppEvent("fan_chip_clicked")}
      aria-label={streak ? `${streak}-day streak. Open your fan card` : "Open your fan card"}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.25,
        py: 0.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 5,
        fontSize: 14,
        fontWeight: 600,
        color: "text.primary",
        textDecoration: "none",
        whiteSpace: "nowrap",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <span aria-hidden>{streak ? "🔥" : "🏅"}</span>
      {streak ? streak : <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Fan card</Box>}
    </Box>
  );
}
