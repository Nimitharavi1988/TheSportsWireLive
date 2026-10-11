import { describe, it, expect } from "vitest";
import { cooldownActive } from "./metaCooldown";

describe("cooldownActive", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  it("is off when there was no limit failure", () => expect(cooldownActive(null, now)).toBe(false));
  it("is on shortly after a limit failure", () => expect(cooldownActive(ago(5), now)).toBe(true));
  it("is off once the cooldown has passed, so one attempt can probe", () => expect(cooldownActive(ago(31), now)).toBe(false));
});
