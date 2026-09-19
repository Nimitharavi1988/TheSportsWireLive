import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pushSubscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// Stores the browser's PushSubscription object (from
// registration.pushManager.subscribe() in NotificationOptInBanner.tsx) so
// admin/actions.ts's sendPushNotification can reach it later. Anonymous —
// no cookie/session tie, matching Poll/ArticleReaction's own
// no-accounts-on-this-site pattern; the subscription's endpoint URL is
// already the unique identifier a browser's push service gives it.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : null;
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : null;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const [existing] = await db.select({ id: pushSubscription.id }).from(pushSubscription)
    .where(eq(pushSubscription.endpoint, endpoint)).limit(1);

  if (existing) {
    await db.update(pushSubscription).set({ p256dh, auth }).where(eq(pushSubscription.id, existing.id));
  } else {
    await db.insert(pushSubscription).values({ id: createId(), endpoint, p256dh, auth });
  }

  return NextResponse.json({ ok: true });
}

// Browser fires this when a subscription expires/is revoked
// (pushsubscriptionchange) — NotificationOptInBanner.tsx re-subscribes and
// re-POSTs, but the OLD endpoint row would otherwise sit in the table
// forever pointing at a dead subscription. Deleting on unsubscribe/removal
// keeps the table matching what's actually still subscribed.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) return NextResponse.json({ error: "endpoint is required" }, { status: 400 });

  await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint));
  return NextResponse.json({ ok: true });
}
