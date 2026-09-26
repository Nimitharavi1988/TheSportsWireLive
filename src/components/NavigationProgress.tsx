"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Thin progress bar at the top of the window during in-site navigation.
// Replaces the per-route loading.tsx screens (a blank page + spinner or a
// skeleton that flashed on every click): pages are now served from cache
// in ~0.2-0.4s, so the current page stays on screen until the next one is
// ready, and this bar is the only "working on it" signal. No library.
const BRAND = "#1d6b3f";

function isInternalNavigation(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page (or only the hash differs): no navigation to show.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url.pathname + url.search;
}

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start on an internal link click or back/forward.
  useEffect(() => {
    const start = () => {
      setState("loading");
      if (safety.current) clearTimeout(safety.current);
      safety.current = setTimeout(() => setState("idle"), 10_000);
    };
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, []);

  // Finish when the new route has rendered.
  useEffect(() => {
    // The route change is the external event this syncs to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s === "loading" ? "done" : s));
    if (safety.current) clearTimeout(safety.current);
    const t = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 300);
    return () => clearTimeout(t);
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 3,
        zIndex: 2000,
        pointerEvents: "none",
        background: BRAND,
        boxShadow: `0 0 6px ${BRAND}`,
        width: state === "idle" ? "0%" : state === "loading" ? "80%" : "100%",
        opacity: state === "done" ? 0 : state === "loading" ? 1 : 0,
        // Eases toward 80% while waiting, snaps to 100% and fades when done.
        transition:
          state === "loading" ? "width 2.5s cubic-bezier(0.1, 0.7, 0.3, 1), opacity 0.1s"
          : state === "done" ? "width 0.2s ease-out, opacity 0.3s ease 0.15s"
          : "none",
      }}
    />
  );
}

// useSearchParams needs a Suspense boundary in the root layout.
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
