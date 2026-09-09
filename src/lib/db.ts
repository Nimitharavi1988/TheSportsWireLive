import { PrismaClient } from "../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { withAccelerate } from "@prisma/extension-accelerate";

// Standard Next.js pattern: avoid creating a new PrismaClient on every
// hot-reload in development, which would exhaust your DB connections.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const databaseUrl = process.env.DATABASE_URL ?? "";

// Two connection modes, auto-detected by connection string scheme:
//  - `prisma://` / `prisma+postgres://` (Prisma Accelerate) — required in
//    production on Cloudflare Workers. Both Prisma engine modes we tried
//    directly (the classic Rust engine, and the newer Rust-free WASM
//    client) hit a Workers sandbox restriction at startup — eval-based
//    code generation and dynamic WASM compilation, respectively, are both
//    blocked outright. Accelerate proxies queries over plain HTTPS with no
//    local query engine at all, so neither restriction applies.
//  - `postgresql://` (direct Neon connection) — used locally in dev via
//    the Neon driver adapter. Plain Node.js has neither restriction, so
//    there's no reason to spend Accelerate's free-tier query quota
//    (60k/month) on local development traffic.
const isAccelerate = databaseUrl.startsWith("prisma://") || databaseUrl.startsWith("prisma+postgres://");

// TEMPORARY diagnostic — remove once the Cloudflare env var issue is
// resolved. Logs only the connection string's scheme/first 15 chars (never
// the secret itself) so we can confirm from Workers Logs whether the
// deployed Worker is actually seeing the Accelerate URL at runtime, rather
// than continuing to guess about dashboard environment scoping.
console.error(
  `[DIAGNOSTIC] DATABASE_URL prefix: "${databaseUrl.slice(0, 15)}" | length: ${databaseUrl.length} | isAccelerate: ${isAccelerate}`
);

function createClient(): PrismaClient {
  if (isAccelerate) {
    // The extended client is a strict superset (same base model methods,
    // plus $accelerate and an optional cacheStrategy arg nothing here
    // uses) — cast to the plain client type so `db`'s type is consistent
    // regardless of which branch ran; a union of the two real types
    // breaks TypeScript's ability to resolve the overloaded model methods
    // (findMany, findUnique, etc.) at every call site across the app.
    return new PrismaClient().$extends(withAccelerate()) as unknown as PrismaClient;
  }
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
