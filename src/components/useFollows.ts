"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  FOLLOWS_CHANGED_EVENT,
  followKey,
  parseFollows,
  readBrowserFollows,
  serializeFollows,
  writeBrowserFollows,
  MAX_FOLLOWS,
  type FollowRef,
} from "@/lib/follows";

function subscribe(onChange: () => void) {
  window.addEventListener(FOLLOWS_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(FOLLOWS_CHANGED_EVENT, onChange);
}

// A string snapshot (not the parsed array) so React can compare it by value.
const getSnapshot = () => serializeFollows(readBrowserFollows());
// The server can't see the cookie — null means "not read yet".
const getServerSnapshot = () => null;

// Shared follow state for every Follow button, the homepage strip, and the
// For You manager. The cookie is the source of truth; writeBrowserFollows
// broadcasts a change event so all mounted instances stay in sync.
//
// `ready` stays false until the cookie has been read in the browser, so
// anything follow-dependent can wait for it rather than flash a wrong
// "Follow"/"Following" state during hydration.
export function useFollows() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const follows = useMemo(() => (raw === null ? [] : parseFollows(raw)), [raw]);

  const isFollowing = useCallback(
    (ref: FollowRef) => follows.some((f) => followKey(f) === followKey(ref)),
    [follows]
  );

  // Re-reads the cookie rather than trusting this instance's state, so two
  // quick toggles from different components can't overwrite each other.
  const toggle = useCallback((ref: FollowRef) => {
    const current = readBrowserFollows();
    const key = followKey(ref);
    const next = current.some((f) => followKey(f) === key)
      ? current.filter((f) => followKey(f) !== key)
      : [...current, ref].slice(-MAX_FOLLOWS);
    writeBrowserFollows(next);
  }, []);

  return { follows, ready: raw !== null, isFollowing, toggle };
}
