"use client";

import { useEffect } from "react";

// Registers public/sw.js — see that file's comment for why it exists (PWA
// installability, not offline caching yet).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
