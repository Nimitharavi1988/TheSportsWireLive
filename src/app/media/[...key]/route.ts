import { mediaBucket } from "@/lib/media";

// Serves photos uploaded in admin (see lib/media.ts). Keys are unique per
// upload and never overwritten, so they're cached for good.
export async function GET(_request: Request, props: { params: Promise<{ key: string[] }> }) {
  const { key } = await props.params;
  const path = key.join("/");
  if (!/^stories\/\d{4}\/\d{2}\/[\w-]+\.(jpg|png|webp)$/.test(path)) return new Response("Not found", { status: 404 });

  const object = await (await mediaBucket()).get(path);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
