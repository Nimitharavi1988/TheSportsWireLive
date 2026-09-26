"use client";

import { useSyncExternalStore } from "react";

// Whether to ask the reader to install the app or enable notifications —
// decided ONCE per visit and shared by every page, instead of by each
// banner when it mounts. Each banner used to start hidden and decide in an
// effect, so every section switch (a new page since /sport/<category>)
// remounted it hidden and then showed it: a flicker that pushed the page
// down on every menu click (reported 2026-09-26). Android's
// beforeinstallprompt also fires only once per full page load, so a
// banner mounted later (or remounted) never saw it. Started from the root
// layout (ServiceWorkerRegister), so the event is caught on any page.

type InstallStatus = "unknown" | "available" | "ios" | "none";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<unknown>;
}

export interface AppPromptsState {
  install: InstallStatus;
  notify: boolean;
  installEvent: BeforeInstallPromptEvent | null;
}

const INSTALL_DISMISSED = "sw-install-banner-dismissed";
const NOTIFY_DISMISSED = "sw-notif-banner-dismissed";
// No beforeinstallprompt within this long: the browser won't offer one.
const INSTALL_DECIDE_MS = 2000;

const SERVER_STATE: AppPromptsState = { install: "unknown", notify: false, installEvent: null };
let state: AppPromptsState = SERVER_STATE;
const listeners = new Set<() => void>();
let started = false;

function update(patch: Partial<AppPromptsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

// Storage can be unavailable (private mode, blocked site data): then don't
// ask at all rather than ask on every page.
function wasDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return true;
  }
}

function remember(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Nothing to do — the banner still hides for this visit.
  }
}

export function startAppPrompts() {
  if (started || typeof window === "undefined") return;
  started = true;

  const notify =
    !wasDismissed(NOTIFY_DISMISSED) &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Notification.permission === "default" &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

  if (wasDismissed(INSTALL_DISMISSED) || window.matchMedia("(display-mode: standalone)").matches) {
    update({ install: "none", notify });
    return;
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    update({ install: "available", installEvent: e as BeforeInstallPromptEvent });
  });
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    update({ install: "ios", notify });
  } else {
    update({ notify });
    setTimeout(() => {
      if (state.install === "unknown") update({ install: "none" });
    }, INSTALL_DECIDE_MS);
  }
}

function subscribe(listener: () => void) {
  startAppPrompts();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppPrompts(): AppPromptsState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

export function dismissInstall() {
  remember(INSTALL_DISMISSED);
  update({ install: "none", installEvent: null });
}

export function dismissNotify() {
  remember(NOTIFY_DISMISSED);
  update({ notify: false });
}
