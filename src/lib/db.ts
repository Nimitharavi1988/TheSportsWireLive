import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

// Standard Next.js pattern: avoid creating a new PrismaClient on every
// hot-reload in development, which would exhaust your DB connections.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Neon's WebSocket driver adapter, not a raw TCP connection — required on
// Cloudflare Workers, which can't hold a native TCP socket open. Deliberately
// NOT setting `neonConfig.webSocketConstructor` to the `ws` npm package —
// that's a Node-specific polyfill that breaks on Workers (which has its own
// native WebSocket) and isn't needed locally either, since Node 22+ (this
// project runs on Node 24) has a native WebSocket global too. Confirmed via
// a real Cloudflare Workers deploy: setting it to `ws` caused Prisma's
// engine initialization to fail outright (loadEngine/instantiateLibrary).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);

export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
