import { afterEach, describe, expect, it, vi } from "vitest";
import { pushIsConfigured } from "./pushConfig";

describe("pushIsConfigured", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("needs both VAPID keys", () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    expect(pushIsConfigured()).toBe(false);
    vi.stubEnv("VAPID_PRIVATE_KEY", "private");
    expect(pushIsConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public");
    expect(pushIsConfigured()).toBe(true);
  });
});
