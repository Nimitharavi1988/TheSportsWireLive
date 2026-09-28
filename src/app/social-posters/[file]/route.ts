import { db } from "@/db";
import { socialPosterImage } from "@/db/schema";
import { eq } from "drizzle-orm";

// A social poster while it's being posted (lib/social/socialPoster.ts), for
// Instagram and Facebook to fetch by URL. Stored in the database for the
// few minutes it's needed instead of committed to the repo — each commit
// was a full site deploy. 404 once the post is done and the row is gone.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const slug = file.replace(/\.png$/, "");
  if (!file.endsWith(".png") || !slug) return new Response("Not found", { status: 404 });
  const [row] = await db.select({ png: socialPosterImage.pngBase64 }).from(socialPosterImage).where(eq(socialPosterImage.slug, slug)).limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  const bytes = Uint8Array.from(atob(row.png), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": "image/png",
      "content-length": String(bytes.length),
      // Short: the poster only exists while it's being posted.
      "cache-control": "public, max-age=600",
    },
  });
}
