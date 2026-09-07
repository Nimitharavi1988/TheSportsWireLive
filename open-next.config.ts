import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// R2 backs the ISR (`revalidate`) cache — Workers are stateless/multi-instance,
// so ISR needs a durable shared store to behave correctly across requests.
// Requires an R2 bucket bound as CACHE_R2_BUCKET in wrangler.jsonc.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
