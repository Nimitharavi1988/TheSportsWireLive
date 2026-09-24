import { describe, it, expect } from "vitest";
import { isPushWorthy } from "./pushWorthy";

describe("isPushWorthy", () => {
  it("requires both a major event keyword and a tracked superstar", () => {
    expect(isPushWorthy("Cristiano Ronaldo announces retirement from international football")).toBe(true);
    expect(isPushWorthy("Kohli breaks all-time record for most international centuries")).toBe(true);
  });

  it("rejects a major event about a non-tracked player", () => {
    expect(isPushWorthy("Local club captain announces retirement after 20 years")).toBe(false);
  });

  it("rejects routine news about a tracked superstar", () => {
    expect(isPushWorthy("Messi signs new boot deal with sponsor")).toBe(false);
    expect(isPushWorthy("Ronaldo transfer rumours heat up ahead of window")).toBe(false);
  });

  it("rejects isHighlightWorthy-only content that isn't in the stricter allowlist", () => {
    // "confirmed" / "deal" / "sign" are real EVENT_KEYWORDS entries (so
    // isHighlightWorthy would match), but deliberately excluded from
    // PUSH_WORTHY_EVENT_KEYWORDS as too routine for an interrupt-your-phone
    // channel.
    expect(isPushWorthy("Mbappe transfer confirmed in major deal")).toBe(false);
  });

  it("matches a real death/tribute headline for a tracked star", () => {
    expect(isPushWorthy("Football world mourns as legend dies aged 82")).toBe(false); // no tracked name
    expect(isPushWorthy("Pele tribute pours in from across football world")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isPushWorthy("KOHLI SETS NEW RECORD IN HISTORIC INNINGS")).toBe(true);
  });
});
