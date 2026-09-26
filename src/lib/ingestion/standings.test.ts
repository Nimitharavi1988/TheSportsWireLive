import { describe, it, expect } from "vitest";
import { zoneFor } from "./standings";

describe("zoneFor", () => {
  it("marks top and bottom places by each league's own rules", () => {
    expect(zoneFor("PL", 4, 20)?.key).toBe("cl");
    expect(zoneFor("PL", 5, 20)).toBeUndefined();
    expect(zoneFor("PL", 18, 20)?.key).toBe("rel");
    expect(zoneFor("BL1", 16, 18)?.key).toBe("relpo");
    expect(zoneFor("BL1", 17, 18)?.key).toBe("rel");
    expect(zoneFor("ELC", 2, 24)?.key).toBe("promo");
    expect(zoneFor("ELC", 6, 24)?.key).toBe("promopo");
    expect(zoneFor("ELC", 22, 24)?.key).toBe("rel");
  });

  it("claims nothing it isn't sure of", () => {
    expect(zoneFor("PPL", 1, 18)).toBeUndefined();
    expect(zoneFor("XYZ", 1, 20)).toBeUndefined();
  });
});
