"use client";

import { usePathname } from "next/navigation";

// A plain <Link> navigation in App Router swaps the page segment instantly
// with no visual transition at all — the new content just appears, which
// reads as an abrupt cut (part of why navigation "feels like a full
// reload" even though it's already client-side). Next 16.3.4 doesn't yet
// support the framework-level experimental.viewTransition flag (checked
// directly — it's rejected as an unrecognized config key), so this is a
// plain CSS fade instead: keying the wrapper on the pathname forces React
// to remount it on every route change, retriggering the fadeIn animation
// defined in globals.css. Works in every browser, no experimental flag.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
