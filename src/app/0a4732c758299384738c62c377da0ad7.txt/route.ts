// IndexNow key verification file — the protocol requires it hosted at the
// site root, named exactly after the key. Duplicated here as a literal
// (rather than read from INDEXNOW_KEY) because the URL path itself has to
// be the key, which can't be templated at request time — this and the
// INDEXNOW_KEY env var must always match; see src/lib/indexNow.ts.
export async function GET() {
  return new Response("0a4732c758299384738c62c377da0ad7", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
