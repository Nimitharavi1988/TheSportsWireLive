// Runs `run` once the page has loaded and the browser is idle — for work
// readers don't need for the first paint (ad slots). Returns a cancel
// function for effect cleanup. Browser-only.
//
// Why (2026-09-27): once the ad slots really requested ads, AdSense's work
// (ad script, a forced re-layout, its check frames) landed on top of the
// first paint — PageSpeed mobile went from 87 to 60 with the page itself
// loaded in 0.8s but not painted until 2.4s.
export function whenPageIdle(run: () => void): () => void {
  let cancelled = false;
  let idleId: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (cancelled) return;
    if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(() => !cancelled && run(), { timeout: 3000 });
    else timer = setTimeout(() => !cancelled && run(), 1500);
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    clearTimeout(timer);
  };
}
