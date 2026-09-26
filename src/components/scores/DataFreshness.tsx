"use client";

import { useSyncExternalStore } from "react";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";

// One shared 30s clock for every "updated X ago" on the page. null on the
// server and during hydration (the page may be a cached copy), so the
// relative time only ever renders in the reader's browser.
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => now || Date.now(), () => null);
}

export function updatedAgo(iso: string, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

// "ESPN · updated 2 min ago" — where a score comes from and, for a game in
// play, how current it is. Finals and upcoming games show the source only.
export function DataSource({ match }: { match: ScoreMatch }) {
  const nowMs = useNow();
  const inPlay = match.state === "live" || match.state === "paused" || match.state === "started";
  return (
    <span>
      {match.source}
      {inPlay && nowMs !== null ? ` · updated ${updatedAgo(match.updatedAt, nowMs)}` : ""}
    </span>
  );
}
