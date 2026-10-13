"use client";

import { useEffect } from "react";
import { trackAppEvent } from "./appPrompts";

// Anonymous "this page was opened" counter (once per browser session). Renders nothing.
export function AppEventOnMount({ kind }: { kind: string }) {
  useEffect(() => {
    trackAppEvent(kind);
  }, [kind]);
  return null;
}
