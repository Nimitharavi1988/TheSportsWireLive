/**
 * Splits a display score into what is read at a glance and the detail that
 * goes on a smaller second line, so a long cricket score never pushes a
 * score card out of alignment:
 *   "322/9 (50 ov)"                  -> main "322/9",          detail "50 ov"
 *   "145/4 (28 ov, target 191)"      -> main "145/4",          detail "28 ov, target 191"
 *   "364 & 134/2 (27.5 ov)"          -> main "364 & 134/2",    detail "27.5 ov"
 *   "24"                             -> main "24",             detail null
 */
export function splitScore(score: string | null): { main: string; detail: string | null } {
  if (!score) return { main: "", detail: null };
  const open = score.indexOf("(");
  if (open <= 0) return { main: score.trim(), detail: null };
  const detail = score.slice(open + 1).replace(/\)\s*$/, "").trim();
  return { main: score.slice(0, open).trim(), detail: detail || null };
}
