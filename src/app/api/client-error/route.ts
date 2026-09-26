import { NextResponse } from "next/server";
import { db } from "@/db";
import { clientError } from "@/db/schema";

// Receives browser crashes from the error pages (src/app/error.tsx,
// global-error.tsx) and stores them in ClientError, so an error only a
// reader's device hits can still be diagnosed. Public, so every field is
// length-capped and oversized bodies are dropped.
export const dynamic = "force-dynamic";

const MAX_BODY = 16_000;

const clip = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.slice(0, max) : null;

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return new NextResponse(null, { status: 413 });
    const body = JSON.parse(text) as Record<string, unknown>;
    const message = clip(body.message, 500);
    if (!message) return new NextResponse(null, { status: 400 });
    await db.insert(clientError).values({
      message,
      stack: clip(body.stack, 4000),
      digest: clip(body.digest, 100),
      url: clip(body.url, 500),
      userAgent: clip(request.headers.get("user-agent"), 300),
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("client-error endpoint failed:", err);
    return new NextResponse(null, { status: 500 });
  }
}
