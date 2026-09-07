import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Standard Next.js pattern: avoid creating a new PrismaClient on every
// hot-reload in development, which would exhaust your DB connections.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Neon's WebSocket driver adapter, not a raw TCP connection — required on
// Cloudflare Workers, which can't hold a native TCP socket open.
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);

export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
