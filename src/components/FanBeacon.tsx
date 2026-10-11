"use client";

import { useEffect } from "react";

export const FAN_STORAGE_KEY = "swl-fan";
export const FAN_UPDATED_EVENT = "swl:fan-updated";
const FAN_DAY_KEY = "swl-fan-day";

function localDay(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Counts one active day per visitor, for the fan card streak. Waits for a real
// interaction (tap, key, scroll) so crawlers and instant bounces are never
// counted, and asks at most once per local day (remembered in localStorage).
// Renders nothing.
export function FanBeacon() {
  useEffect(() => {
    let done = false;
    const day = localDay();
    try {
      if (localStorage.getItem(FAN_DAY_KEY) === day) return;
    } catch {
      return; // storage blocked: skip rather than count a visit every page
    }

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    const stop = () => events.forEach((e) => window.removeEventListener(e, fire));

    async function fire() {
      if (done) return;
      done = true;
      stop();
      try {
        const res = await fetch("/api/fan/visit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ day }),
        });
        if (!res.ok) return;
        const summary = res.status === 204 ? null : await res.json();
        localStorage.setItem(FAN_DAY_KEY, day);
        if (summary) {
          localStorage.setItem(FAN_STORAGE_KEY, JSON.stringify(summary));
          window.dispatchEvent(new CustomEvent(FAN_UPDATED_EVENT));
        }
      } catch {
        /* a missed day is retried on the next page view */
      }
    }

    events.forEach((e) => window.addEventListener(e, fire, { passive: true, once: false }));
    return stop;
  }, []);

  return null;
}
