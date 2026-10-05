import { describe, it, expect, vi, beforeEach } from "vitest";

// callGemini keeps module-level state (the "AI unavailable" flag), so each
// test loads a fresh copy with its own stand-in for the router.
beforeEach(() => {
  vi.resetModules();
  delete process.env.GEMINI_API_KEY;
});

type FakeResult = { data: unknown | null; failure?: "rate-limited" | "invalid" | "none"; via?: string; attempts: string[] };

async function load(router: { json: (req: unknown) => Promise<FakeResult> } | null) {
  vi.doMock("../llm", () => ({ getRouter: async () => router }));
  return import("./commentary");
}

const SCHEMA = { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] };

describe("callGemini with the AI router", () => {
  it("sends the lite tier by default and the standard tier for a named model, with the priority", async () => {
    const seen: unknown[] = [];
    const m = await load({ json: async (req) => { seen.push(req); return { data: { ok: true }, attempts: [] }; } });
    await m.callGemini("p", { responseSchema: SCHEMA });
    await m.callGemini("p", { responseSchema: SCHEMA, model: "gemini-flash-latest", priority: "high", temperature: 0.1, maxOutputTokens: 99 });
    expect(seen[0]).toMatchObject({ tier: "lite", prompt: "p" });
    expect(seen[1]).toMatchObject({ tier: "standard", priority: "high", temperature: 0.1, maxOutputTokens: 99 });
  });

  it("returns the router's answer and leaves the AI marked available", async () => {
    const m = await load({ json: async () => ({ data: { ok: true }, attempts: [] }) });
    expect(await m.callGemini("p", { responseSchema: SCHEMA })).toEqual({ ok: true });
    expect(m.aiUnavailableReason()).toBeNull();
  });

  it("marks the AI unavailable when no provider has room, so stories wait instead of being rejected", async () => {
    const json = vi.fn(async () => ({ data: null, failure: "rate-limited", attempts: ["x"] }) as FakeResult);
    const m = await load({ json });
    expect(await m.callGemini("p", { responseSchema: SCHEMA })).toBeNull();
    expect(m.aiUnavailableReason()).toMatch(/free provider/);
    await m.callGemini("p", { responseSchema: SCHEMA });
    expect(json).toHaveBeenCalledTimes(1); // the rest of the run doesn't keep asking
  });

  it("does not mark the AI unavailable when it answered but the answer was unusable", async () => {
    const m = await load({ json: async () => ({ data: null, failure: "invalid", attempts: ["x"] }) });
    expect(await m.callGemini("p", { responseSchema: SCHEMA })).toBeNull();
    expect(m.aiUnavailableReason()).toBeNull();
  });

  it("uses the Gemini key directly, as before, when there is no router", async () => {
    const m = await load(null);
    expect(await m.callGemini("p", { responseSchema: SCHEMA })).toBeNull();
    expect(m.aiUnavailableReason()).toMatch(/GEMINI_API_KEY unset/);
  });
});

describe("generateCommentary with the AI router", () => {
  const source = "Rays beat the Yankees 1-0 at Tropicana Field. Drew Rasmussen struck out 10 batters over 8 innings.";
  const answer = (commentary: string) => ({ json: async () => ({ data: { commentary, personNames: ["Drew Rasmussen"], venue: "" }, attempts: [] }) as FakeResult });

  it("keeps a write-up whose figures are all in the source", async () => {
    const m = await load(answer("Drew Rasmussen struck out 10 in 8 innings as the Rays won 1-0."));
    const r = await m.generateCommentary("Rays beat Yankees", source, "MLB.com");
    expect(r.commentary).toContain("struck out 10");
  });

  it("drops a write-up that invents a figure", async () => {
    const m = await load(answer("Drew Rasmussen threw 112 pitches in front of 41,200 fans."));
    const r = await m.generateCommentary("Rays beat Yankees", source, "MLB.com");
    expect(r.commentary).toBeNull();
  });

  it("leaves the check off without the router (Gemini's own behaviour is unchanged)", async () => {
    vi.resetModules();
    process.env.GEMINI_API_KEY = "k";
    vi.doMock("../llm", () => ({ getRouter: async () => null }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ commentary: "He threw 112 pitches.", personNames: [], venue: "" }) }] } }],
    })));
    const m = await import("./commentary");
    const r = await m.generateCommentary("Rays beat Yankees", source, "MLB.com");
    expect(r.commentary).toContain("112");
    fetchSpy.mockRestore();
  });
});
