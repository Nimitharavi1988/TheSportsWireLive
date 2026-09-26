"use client";

import { useEffect, useRef, useState } from "react";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";
import { LIVE_POLL_MS, MAX_LIVE_IDS, mergeMatches, needsLiveUpdate } from "@/lib/scores/liveUpdates";

type Source =
  // Refresh just the cards that can still change (match header, /scores).
  | { mode: "merge" }
  // Re-fetch a whole "live now" list, whose membership changes too
  // (ticker, phone score row).
  | { mode: "list"; url: string };

// Which viewport a widget is visible at — a widget hidden by CSS at the
// current width doesn't poll (the ticker is sm+, the phone row xs only).
type Viewport = "xs" | "sm-up";

function visibleAt(viewport: Viewport | undefined): boolean {
  if (!viewport) return true;
  const smUp = window.matchMedia("(min-width: 600px)").matches;
  return viewport === "sm-up" ? smUp : !smUp;
}

// Keeps score cards current without reloading the page: every minute,
// while the tab is visible and something on screen can still change,
// fetches fresh cards from /api/scores/live. Also refreshes as soon as
// the reader returns to the tab.
export function useLiveScores(initial: ScoreMatch[], source: Source, viewport?: Viewport): ScoreMatch[] {
  const [matches, setMatches] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  // New server data (navigation, revalidated page) replaces local state.
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setMatches(initial);
  }
  const latest = useRef(matches);
  useEffect(() => {
    latest.current = matches;
  }, [matches]);

  const mode = source.mode;
  const listUrl = source.mode === "list" ? source.url : null;

  useEffect(() => {
    let cancelled = false;
    let lastRun = Date.now();
    const tick = async () => {
      if (document.visibilityState !== "visible" || !visibleAt(viewport)) return;
      const now = Date.now();
      const active = latest.current.filter((m) => needsLiveUpdate(m, now));
      if (active.length === 0) return;
      lastRun = now;
      const url = listUrl ?? `/api/scores/live?ids=${active.slice(0, MAX_LIVE_IDS).map((m) => encodeURIComponent(m.id)).join(",")}`;
      try {
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { matches: ScoreMatch[] };
        if (cancelled) return;
        setMatches(mode === "list" ? (data.matches.length > 0 ? data.matches : latest.current) : mergeMatches(latest.current, data.matches));
      } catch {
        // Offline or a blip — keep showing the last known scores.
      }
    };
    const timer = setInterval(tick, LIVE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun > LIVE_POLL_MS / 2) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mode, listUrl, viewport]);

  return matches;
}
