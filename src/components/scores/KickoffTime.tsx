"use client";

import { useViewerTimeZone } from "./useViewerTimeZone";

// Kickoff time in the viewer's own time zone ("3:25 PM"; with the date
// too when `withDate`). See useViewerTimeZone for the UTC-first render.
export function KickoffTime({ iso, withDate = false }: { iso: string; withDate?: boolean }) {
  const timeZone = useViewerTimeZone();
  const date = new Date(iso);
  const text = date.toLocaleString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    ...(withDate ? { weekday: "short", month: "short", day: "numeric" } : {}),
    ...(timeZone === "UTC" ? { timeZoneName: "short" } : {}),
  });
  return <time dateTime={iso}>{text}</time>;
}
