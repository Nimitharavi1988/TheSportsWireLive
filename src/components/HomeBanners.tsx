"use client";

import { useCallback, useState } from "react";
import { InstallAppBanner } from "./InstallAppBanner";
import { NotificationOptInBanner } from "./NotificationOptInBanner";

// Shows at most one banner at a time -- stacking "install the app" and
// "enable notifications" asks back-to-back before a first-time visitor
// even reaches real content read as naggy. Install takes priority (the
// more valuable ask); the notification banner only appears once install
// has definitively decided it has nothing to show (see
// InstallAppBanner.tsx's onVisibilityChange comment).
export function HomeBanners() {
  const [installShowing, setInstallShowing] = useState<boolean | null>(null); // null = not yet determined

  const handleInstallVisibility = useCallback((visible: boolean) => {
    setInstallShowing(visible);
  }, []);

  return (
    <>
      <InstallAppBanner onVisibilityChange={handleInstallVisibility} />
      {installShowing === false && <NotificationOptInBanner />}
    </>
  );
}
