import { getCloudflareContext } from "@opennextjs/cloudflare";

// Photos uploaded in admin (Write a story) live in the MEDIA_BUCKET R2
// bucket and are served by the site itself at /media/<key> — our own
// photos, not hotlinked from other sites. Stored on articles as an absolute
// URL, so Facebook posts and image resizing (imageLoader.ts) work as for
// any other image.

export const MEDIA_PREFIX = "/media/";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Same R2 type OpenNext declares for its own cache bucket.
type Bucket = NonNullable<CloudflareEnv["NEXT_INC_CACHE_R2_BUCKET"]>;

export async function mediaBucket(): Promise<Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.MEDIA_BUCKET) throw new Error("MEDIA_BUCKET binding is missing (wrangler.jsonc)");
  return env.MEDIA_BUCKET;
}

// "stories/2026/09/<id>.jpg" — dated folders keep the bucket browsable.
export function mediaKey(id: string, contentType: string, now: Date = new Date()): string {
  const ext = UPLOAD_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported image type: ${contentType}`);
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `stories/${now.getUTCFullYear()}/${month}/${id}.${ext}`;
}

export function mediaUrl(key: string): string {
  return `${process.env.SITE_URL ?? "http://localhost:3000"}${MEDIA_PREFIX}${key}`;
}
