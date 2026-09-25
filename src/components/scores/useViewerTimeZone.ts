"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const serverTimeZone = () => "UTC";

// The server can't know the visitor's time zone, so the first render (and
// hydration) uses UTC on both sides — no mismatch — then React re-renders
// with the browser's zone. Kickoff times and "Today" then match the viewer.
export function useViewerTimeZone(): string {
  return useSyncExternalStore(noopSubscribe, browserTimeZone, serverTimeZone);
}

export function dayKey(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a string.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
