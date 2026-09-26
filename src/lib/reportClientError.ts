// Sends a browser crash to /api/client-error (see that route). Fire and
// forget: reporting must never cause a second error.
export function reportClientError(error: Error & { digest?: string }): void {
  try {
    const body = JSON.stringify({
      message: `${error.name}: ${error.message}`,
      stack: error.stack,
      digest: error.digest,
      url: window.location.href,
    });
    void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    // Nothing more to do.
  }
}
