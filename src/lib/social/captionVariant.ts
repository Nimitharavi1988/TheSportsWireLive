// A/B split for caption tests: each story gets "hook" or "control" by its id, so
// the two versions run side by side on the same Page and the same days, and the
// version a story got can be recomputed later (no database field needed).
export type CaptionVariant = "hook" | "control";

export function captionVariantFor(articleId: string): CaptionVariant {
  let h = 0;
  for (const c of articleId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 2 === 0 ? "hook" : "control";
}
