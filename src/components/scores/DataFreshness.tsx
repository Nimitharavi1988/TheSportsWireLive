"use client";

import { useSyncExternalStore } from "react";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { useDict } from "@/lib/i18n/LocaleContext";
import { getDict, type Dict } from "@/lib/i18n/dictionary";

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

export function updatedAgo(iso: string, nowMs: number, ago: Dict["scores"]["ago"] = getDict().scores.ago): string {
  const minutes = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000));
  if (minutes < 1) return ago.justNow;
  if (minutes < 60) return ago.min(minutes);
  const hours = Math.round(minutes / 60);
  return hours < 24 ? ago.h(hours) : ago.d(Math.round(hours / 24));
}

// "updated 3 min ago" for any timestamp (browser-only, see useNow).
export function UpdatedAgo({ iso }: { iso: string }) {
  const nowMs = useNow();
  const t = useDict().scores;
  return <span>{nowMs === null ? "" : t.updated(updatedAgo(iso, nowMs, t.ago))}</span>;
}

// "ESPN · updated 2 min ago" — where a score comes from and, for a game in
// play, how current it is. Finals and upcoming games show the source only.
export function DataSource({ match }: { match: ScoreMatch }) {
  const nowMs = useNow();
  const t = useDict().scores;
  const inPlay = match.state === "live" || match.state === "paused" || match.state === "started";
  return (
    <span>
      {match.source}
      {inPlay && nowMs !== null ? ` · ${t.updated(updatedAgo(match.updatedAt, nowMs, t.ago))}` : ""}
    </span>
  );
}

const inPlay = (m: ScoreMatch) => m.state === "live" || m.state === "paused" || m.state === "started";

// "Source: ESPN · updated 2 min ago" for a group of matches: every provider
// in the group, and the latest update among games in play.
export function CardSource({ matches }: { matches: ScoreMatch[] }) {
  const nowMs = useNow();
  const t = useDict().scores;
  const providers = [...new Set(matches.map((m) => m.source))].join(", ");
  const latest = matches.filter(inPlay).map((m) => m.updatedAt).sort().at(-1);
  return (
    <span>
      {t.source}: {providers}
      {latest && nowMs !== null ? ` · ${t.updated(updatedAgo(latest, nowMs, t.ago))}` : ""}
    </span>
  );
}
