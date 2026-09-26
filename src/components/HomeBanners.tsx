"use client";

import { InstallAppBanner } from "./InstallAppBanner";
import { NotificationOptInBanner } from "./NotificationOptInBanner";
import { useAppPrompts } from "./appPrompts";

// Shows at most one banner at a time -- stacking "install the app" and
// "enable notifications" asks back-to-back before a first-time visitor
// even reaches real content read as naggy. Install takes priority (the
// more valuable ask); the notification banner only appears once install
// has definitively nothing to show (appPrompts.ts decides both, once per
// visit, so switching pages never re-shows or flickers them).
export function HomeBanners() {
  const { install } = useAppPrompts();
  return (
    <>
      <InstallAppBanner />
      {install === "none" && <NotificationOptInBanner />}
    </>
  );
}
