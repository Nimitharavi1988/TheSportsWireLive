"use client";

import { useEffect } from "react";
import { startAppPrompts } from "./appPrompts";

// Registers public/sw.js — see that file's comment for why it exists (PWA
// installability, not offline caching yet).
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Also start the install/notification decision here (every page) — the
    // browser's install event fires once, possibly before any banner mounts.
    startAppPrompts();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
