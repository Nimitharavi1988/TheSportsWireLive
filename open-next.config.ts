import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// R2 backs the ISR (`revalidate`) cache — Workers are stateless/multi-instance,
// so ISR needs a durable shared store to behave correctly across requests.
// Requires an R2 bucket bound as NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc —
// this exact name is hardcoded by @opennextjs/cloudflare, not configurable.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
