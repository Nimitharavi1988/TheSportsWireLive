"use client";

import { useEffect } from "react";
import { trackAppEvent } from "./appPrompts";

// Anonymous "fan card opened" counter (once per browser session). Renders nothing.
export function FanCardOpened() {
  useEffect(() => {
    trackAppEvent("fan_card_opened");
  }, []);
  return null;
}
