"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
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

// Header chip that shows a visitor's streak once they have one (2+ days in a
// row) and links to their fan card. Reads the summary FanBeacon last stored,
// so it appears from the next page after a visit is counted. Renders nothing
// on the server and for visitors without a streak.
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

  if (!data || !(data.streak >= 2)) return null;
  return (
    <Box
      component={Link}
      href="/fan-card"
      onClick={() => trackAppEvent("fan_chip_clicked")}
      aria-label={`${data.streak}-day streak. Open your fan card`}
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
      <span aria-hidden>🔥</span> {data.streak}
    </Box>
  );
}
