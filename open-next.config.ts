import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// R2 backs the ISR (`revalidate`) cache — Workers are stateless/multi-instance,
// so ISR needs a durable shared store to behave correctly across requests.
// Requires an R2 bucket bound as NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc —
// this exact name is hardcoded by @opennextjs/cloudflare, not configurable.
//
// queue: what regenerates a cached page once its `revalidate` time has
// passed. Unset, OpenNext uses a no-op queue — confirmed 2026-09-26 that
// cached pages (/standings, /about) only ever changed on a new deploy. The
// memory queue re-renders the page in the background through the
// WORKER_SELF_REFERENCE service binding (already in wrangler.jsonc) while
// visitors keep getting the cached copy.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: memoryQueue,
});
