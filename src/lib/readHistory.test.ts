import { describe, it, expect } from "vitest";
import { pickUnread } from "./readHistory";

describe("pickUnread", () => {
  const c = (slug: string) => ({ slug });

  it("skips stories already read this session, so Up next keeps moving forward", () => {
    // Reader went A -> B: on B, A is B's top candidate but already read.
    expect(pickUnread([c("a"), c("c"), c("d")], ["a", "b"])?.slug).toBe("c");
  });

  it("falls back to the first candidate when all have been read", () => {
    expect(pickUnread([c("a"), c("c")], ["a", "c"])?.slug).toBe("a");
    expect(pickUnread([], ["a"])).toBeNull();
  });
});
