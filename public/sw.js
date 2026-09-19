// Minimal service worker — a registered fetch handler is required for
// Chrome/Android's PWA installability criteria. No caching/offline behavior
// yet; this is the quick-win baseline that makes "Add to Home Screen"
// available, not a full offline-first rewrite.
self.addEventListener("fetch", () => {});

// Shows the actual OS/browser notification when a push message arrives —
// this fires even if no tab has the site open, since the service worker
// runs independently in the background once registered. The payload is
// whatever admin/actions.ts's sendPushNotification put in the web-push
// message body (see PushPayload there).
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192",
      badge: "/icon-192",
      data: { url: payload.url },
    })
  );
});

// Opens (or focuses an existing tab to) the article the notification was
// about — clicking a notification otherwise just dismisses it with no
// navigation at all, which isn't what a reader expects from a headline.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
