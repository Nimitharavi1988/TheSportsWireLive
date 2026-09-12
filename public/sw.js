// Minimal service worker — a registered fetch handler is required for
// Chrome/Android's PWA installability criteria. No caching/offline behavior
// yet; this is the quick-win baseline that makes "Add to Home Screen"
// available, not a full offline-first rewrite.
self.addEventListener("fetch", () => {});
