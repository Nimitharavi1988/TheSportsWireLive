"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the current (ISR-cached) page every `intervalMs` while
// `active` and the tab is visible, so a live score moves without a reload.
export function LiveRefresher({ active, intervalMs = 60_000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);
  return null;
}
