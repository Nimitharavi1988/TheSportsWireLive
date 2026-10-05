import { describe, it, expect } from "vitest";
import { extractJson, toJsonSchema, validateAgainstSchema, type GeminiSchema } from "./schema";
import {
  Pacer, SOFT_CAP, checkBudget, dayKey, estimateTokens, mergeLedgers, nextReset, recordRateLimit, sanitizeLedger, usageFor, type Ledger, type Usage,
} from "./ledger";
import { buildSlots, chainFor, pickOpenRouterFree } from "./providers";
import { LlmRouter, classifyHttpError, retryInSeconds, type LedgerStore } from "./router";
import { ungroundedNumbers } from "./grounding";

const SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: { commentary: { type: "STRING" }, tags: { type: "ARRAY", items: { type: "STRING" } }, verdict: { type: "STRING", enum: ["ok", "major"] } },
  required: ["commentary", "tags"],
};

describe("schema helpers", () => {
  it("converts a Gemini schema to JSON Schema", () => {
    expect(toJsonSchema(SCHEMA)).toMatchObject({ type: "object", properties: { tags: { type: "array", items: { type: "string" } } }, required: ["commentary", "tags"] });
  });

  it("validates required keys, types and enums, and ignores extras", () => {
    expect(validateAgainstSchema({ commentary: "x", tags: [] }, SCHEMA)).toBeNull();
    expect(validateAgainstSchema({ commentary: "x", tags: [], extra: 1 }, SCHEMA)).toBeNull();
    expect(validateAgainstSchema({ tags: [] }, SCHEMA)).toMatch(/commentary is missing/);
    expect(validateAgainstSchema({ commentary: 3, tags: [] }, SCHEMA)).toMatch(/not a string/);
    expect(validateAgainstSchema({ commentary: "x", tags: [1] }, SCHEMA)).toMatch(/tags\[0\]/);
    expect(validateAgainstSchema({ commentary: "x", tags: [], verdict: "bad" }, SCHEMA)).toMatch(/not one of/);
    expect(validateAgainstSchema([], SCHEMA)).toMatch(/not an object/);
  });

  it("finds JSON in fenced, reasoning-prefixed and chatty answers", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('<think>hmm {not json}</think>{"a":2}')).toEqual({ a: 2 });
    expect(extractJson('Sure! Here you go: {"a":3} Hope that helps.')).toEqual({ a: 3 });
    expect(extractJson("no json here")).toBeUndefined();
    expect(extractJson('{"a":')).toBeUndefined();
  });
});

describe("ledger", () => {
  const T = Date.UTC(2026, 9, 4, 12, 0, 0);

  it("turns the quota day at each provider's reset hour", () => {
    expect(dayKey(Date.UTC(2026, 9, 4, 7, 59), 8)).toBe("2026-10-03");
    expect(dayKey(Date.UTC(2026, 9, 4, 8, 0), 8)).toBe("2026-10-04");
    expect(nextReset(Date.UTC(2026, 9, 4, 12), 8)).toBe(Date.UTC(2026, 9, 5, 8));
    expect(nextReset(Date.UTC(2026, 9, 4, 12), 0)).toBe(Date.UTC(2026, 9, 5, 0));
  });

  it("starts a fresh day when the quota day turns", () => {
    const ledger: Ledger = {};
    usageFor(ledger, "k", T, 0).requests = 5;
    expect(usageFor(ledger, "k", T + 60_000, 0).requests).toBe(5);
    expect(usageFor(ledger, "k", T + 24 * 3_600_000, 0).requests).toBe(0);
  });

  it("leaves more headroom for important work", () => {
    const u: Usage = { day: "d", requests: 6, tokens: 0, blockedUntil: 0, strikes: 0 };
    expect(checkBudget(u, { rpd: 10 }, "low", 100, T).ok).toBe(false);
    expect(checkBudget(u, { rpd: 10 }, "normal", 100, T).ok).toBe(true);
    u.requests = 9;
    expect(checkBudget(u, { rpd: 10 }, "normal", 100, T).ok).toBe(false);
    expect(checkBudget(u, { rpd: 10 }, "high", 100, T).ok).toBe(false); // 9 + 1 > floor(9.5)
    u.requests = 8;
    expect(checkBudget(u, { rpd: 10 }, "high", 100, T).ok).toBe(true);
    expect(SOFT_CAP.high).toBeGreaterThan(SOFT_CAP.normal);
  });

  it("counts tokens and refuses a request bigger than the per-minute limit", () => {
    const u: Usage = { day: "d", requests: 0, tokens: 190_000, blockedUntil: 0, strikes: 0 };
    expect(checkBudget(u, { tpd: 200_000 }, "normal", 5_000, T).ok).toBe(false);
    expect(checkBudget(u, { tpm: 8_000 }, "high", 9_000, T).ok).toBe(false);
  });

  it("backs off 1, 2, 4 minutes on rate limits and treats a fourth as the daily quota", () => {
    const u: Usage = { day: "d", requests: 0, tokens: 0, blockedUntil: 0, strikes: 0 };
    recordRateLimit(u, T, 0);
    expect(u.blockedUntil).toBe(T + 60_000);
    recordRateLimit(u, T, 0);
    expect(u.blockedUntil).toBe(T + 120_000);
    recordRateLimit(u, T, 0);
    recordRateLimit(u, T, 0);
    expect(u.blockedUntil).toBe(nextReset(T, 0));
  });

  it("honours a stated wait, and a stated daily limit", () => {
    const a: Usage = { day: "d", requests: 0, tokens: 0, blockedUntil: 0, strikes: 0 };
    recordRateLimit(a, T, 0, { retryAfterSec: 20 });
    expect(a.blockedUntil).toBe(T + 20_000);
    const b: Usage = { ...a, blockedUntil: 0, strikes: 0 };
    recordRateLimit(b, T, 0, { daily: true });
    expect(b.blockedUntil).toBe(nextReset(T, 0));
  });

  it("paces requests per minute and tokens per minute", () => {
    const p = new Pacer();
    for (let i = 0; i < 3; i++) p.record("k", 100, T + i * 1000);
    expect(p.waitMs("k", { rpm: 3 }, 100, T + 3000)).toBe(T + 60_000 - (T + 3000));
    expect(p.waitMs("k", { rpm: 4 }, 100, T + 3000)).toBe(0);
    expect(p.waitMs("k", { tpm: 350 }, 100, T + 3000)).toBeGreaterThan(0);
    expect(p.waitMs("k", { rpm: 3 }, 100, T + 61_000)).toBe(0);
  });

  it("estimates a reply from the prompt, capped by the maximum allowed", () => {
    // A 5,000-character translation prompt: ~1,430 tokens in, ~2,000 out, not 4,900.
    expect(estimateTokens(5000, 8192)).toBeLessThan(3600);
    // A short prompt with a small maximum is bounded by the maximum.
    expect(estimateTokens(700, 100)).toBe(200 + 60);
  });

  it("repairs a damaged ledger and merges two jobs' copies", () => {
    expect(sanitizeLedger("junk")).toEqual({});
    expect(sanitizeLedger({ a: { day: "d", requests: "x", tokens: -4, blockedUntil: 5, strikes: 1 }, b: 7, c: null })).toEqual({
      a: { day: "d", requests: 0, tokens: 0, blockedUntil: 5, strikes: 1 },
    });
    const local: Ledger = { k: { day: "2026-10-04", requests: 5, tokens: 100, blockedUntil: 0, strikes: 0 } };
    const remote: Ledger = {
      k: { day: "2026-10-04", requests: 7, tokens: 50, blockedUntil: 999, strikes: 3 },
      z: { day: "2026-10-04", requests: 1, tokens: 1, blockedUntil: 0, strikes: 0 },
    };
    expect(mergeLedgers(local, remote).k).toEqual({ day: "2026-10-04", requests: 7, tokens: 100, blockedUntil: 999, strikes: 0 });
    expect(mergeLedgers(local, remote).z.requests).toBe(1);
    expect(mergeLedgers({ k: { ...local.k, day: "2026-10-03" } }, remote).k.requests).toBe(7);
  });
});

describe("providers", () => {
  const ALL = { GEMINI_FREE_API_KEY: "g", GROQ_API_KEY: "q", OPENROUTER_API_KEY: "o", OPENROUTER_FREE_MODELS: "or-a:free,or-b:free" };

  it("orders slots best-first per tier", () => {
    const slots = buildSlots(ALL);
    // Gemma is last: the 2026-10-04 test found it stalls on its 16K tokens/min.
    expect(chainFor(slots, "lite").map((s) => s.id)).toEqual([
      "gemini-free lite", "gemini-free lite31", "groq openai/gpt-oss-120b", "groq qwen/qwen3.8-27b", "openrouter or-a:free", "openrouter or-b:free", "gemini-free gemma31", "gemini-free gemma26",
    ]);
    // Standard work: Groq's 120B first (best in the test), then the Flash-Lite
    // models; the four Flash models (20 a day each) are not offered to ordinary work.
    const standard = ["groq openai/gpt-oss-120b", "gemini-free lite", "gemini-free lite31", "groq qwen/qwen3.8-27b", "openrouter or-a:free", "openrouter or-b:free", "gemini-free gemma31", "gemini-free gemma26"];
    expect(chainFor(slots, "standard").map((s) => s.id)).toEqual(standard);
    expect(chainFor(slots, "standard", "low").map((s) => s.id)).toEqual(standard);
    // High-priority work gets those Flash models first.
    expect(chainFor(slots, "standard", "high").map((s) => s.id)).toEqual(["gemini-free flash38", "gemini-free flash37", "gemini-free flash36", "gemini-free flash35", ...standard]);
  });

  it("gives each free model its own allowance, as the AI Studio rate-limit page lists them", () => {
    const by = Object.fromEntries(buildSlots(ALL).map((s) => [s.id, s]));
    expect(by["gemini-free lite"].limits).toMatchObject({ rpm: 14, rpd: 500 });
    expect(by["gemini-free lite31"].limits).toMatchObject({ rpm: 14, rpd: 500 });
    expect(by["gemini-free lite31"].budgetKey).not.toBe(by["gemini-free lite"].budgetKey);
    expect(by["gemini-free gemma31"].limits).toMatchObject({ rpd: 14000, tpm: 15000 });
    expect(by["gemini-free flash38"].limits.rpd).toBe(20);
    expect(by["gemini-free flash38"].highOnly).toBe(true);
  });

  it("has no paid slot unless asked, and puts it last with a hard cap", () => {
    expect(buildSlots({ ...ALL, GEMINI_API_KEY: "p" }).some((s) => s.paid)).toBe(false);
    const withPaid = buildSlots({ ...ALL, GEMINI_API_KEY: "p", LLM_PAID_DAILY_CALLS: "5" });
    const chain = chainFor(withPaid, "lite");
    expect(chain.at(-1)?.paid).toBe(true);
    expect(chain.at(-1)?.limits.rpd).toBe(5);
    expect(buildSlots({ GEMINI_API_KEY: "p", LLM_PAID_DAILY_CALLS: "5" }).every((s) => s.paid)).toBe(true);
  });

  it("switches providers off by name, or part of one", () => {
    expect(chainFor(buildSlots({ ...ALL, LLM_DISABLE: "groq, openrouter" }), "lite").map((s) => s.id))
      .toEqual(["gemini-free lite", "gemini-free lite31", "gemini-free gemma31", "gemini-free gemma26"]);
    expect(chainFor(buildSlots({ ...ALL, LLM_DISABLE: "gemma,lite31,openrouter" }), "lite").map((s) => s.id))
      .toEqual(["gemini-free lite", "groq openai/gpt-oss-120b", "groq qwen/qwen3.8-27b"]);
    expect(buildSlots({ ...ALL, LLM_DISABLE: "gemini-free" }).some((s) => s.id.startsWith("gemini-free"))).toBe(false);
  });

  it("skips providers without a key", () => {
    expect(buildSlots({})).toEqual([]);
    expect(buildSlots({ GROQ_API_KEY: "" })).toEqual([]);
  });

  it("picks free OpenRouter models that can return JSON, avoiding safety and preview ones", () => {
    const m = (id: string, ctx: number, params: string[], price = "0") => ({ id, context_length: ctx, pricing: { prompt: price, completion: price }, supported_parameters: params });
    expect(pickOpenRouterFree([
      m("qwen/qwen3.8-27b:free", 262144, ["structured_outputs"]),
      m("nvidia/nemotron-3-super-120b-a12b:free", 262144, ["response_format", "structured_outputs"]),
      m("nvidia/nemotron-3.5-content-safety:free", 128000, ["response_format"]),
      m("google/gemma-4-31b-it:free", 262144, ["response_format"]),
      m("someone/preview-model:free", 262144, ["response_format"]),
      m("tiny/model:free", 8000, ["response_format"]),
      m("paid/model", 262144, ["response_format"], "0.1"),
      m("no/json:free", 262144, []),
    ])).toEqual(["qwen/qwen3.8-27b:free", "google/gemma-4-31b-it:free"]);
  });
});

describe("HTTP errors", () => {
  const h = (v: Record<string, string> = {}) => ({ get: (n: string) => v[n.toLowerCase()] ?? null });

  it("reads a rate limit's wait and whether it is the daily quota", () => {
    expect(classifyHttpError(429, h({ "retry-after": "12" }), "slow down")).toMatchObject({ kind: "rate-limit", retryAfterSec: 12, daily: false });
    expect(classifyHttpError(429, h(), '{"error":{"details":[{"retryDelay":"31s"}]}}')).toMatchObject({ retryAfterSec: 31 });
    expect(classifyHttpError(429, h(), "Rate limit reached for requests per day (RPD)")).toMatchObject({ daily: true });
    expect(classifyHttpError(429, h(), "GenerateRequestsPerDayPerProjectPerModel-FreeTier")).toMatchObject({ daily: true });
  });

  it("reads Google's free-tier daily limit, which only says 'retry in 1h29m'", () => {
    const body = "You exceeded your current quota. * Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash Please retry in 1h29m28.163317664s.";
    expect(retryInSeconds(body)).toBe(5369);
    expect(retryInSeconds("Please retry in 31s")).toBe(31);
    expect(retryInSeconds("Please retry in 2m")).toBe(120);
    expect(retryInSeconds("nothing here")).toBeUndefined();
    expect(classifyHttpError(429, h(), body)).toMatchObject({ kind: "rate-limit", daily: true, retryAfterSec: 5369 });
    expect(classifyHttpError(429, h(), "Please retry in 20s")).toMatchObject({ daily: false, retryAfterSec: 20 });
  });

  it("blocks until the time a provider names for a used-up allowance, but not past the quota day", () => {
    const T = Date.UTC(2026, 9, 4, 12);
    const u: Usage = { day: "d", requests: 0, tokens: 0, blockedUntil: 0, strikes: 0 };
    recordRateLimit(u, T, 8, { daily: true, retryAfterSec: 5369 });
    expect(u.blockedUntil).toBe(T + 5369_000);
    const v: Usage = { ...u, blockedUntil: 0, strikes: 0 };
    recordRateLimit(v, T, 8, { daily: true, retryAfterSec: 25 * 3600 }); // would pass the next 08:00 UTC reset
    expect(v.blockedUntil).toBe(nextReset(T, 8));
  });

  it("blocks for a long time on auth, payment and missing-model errors, and retries server errors", () => {
    expect(classifyHttpError(401, h(), "")).toMatchObject({ kind: "blocked" });
    expect(classifyHttpError(402, h(), "")).toMatchObject({ kind: "blocked" });
    expect(classifyHttpError(404, h(), "model not found")).toMatchObject({ kind: "blocked" });
    expect(classifyHttpError(503, h(), "")).toMatchObject({ kind: "transient" });
  });
});

// ---- the router, with a fake network and a fake clock ----

type Reply = { status?: number; json?: unknown; text?: string; headers?: Record<string, string> };
function fakeNetwork(handler: (url: string, body: Record<string, unknown>) => Reply) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url: String(url), body });
    const r = handler(String(url), body);
    return new Response(r.json !== undefined ? JSON.stringify(r.json) : r.text ?? "", { status: r.status ?? 200, headers: r.headers });
  }) as typeof fetch;
  return { fn, calls, count: (host: string) => calls.filter((c) => c.url.includes(host)).length };
}

const gemini = (obj: unknown) => ({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }], usageMetadata: { totalTokenCount: 120 } } });
const openai = (obj: unknown) => ({ json: { choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) } }], usage: { total_tokens: 120 } } });
const GOOD = { commentary: "A fine write-up.", tags: ["a"] };
const REQ = { prompt: "Write about the match.", schema: SCHEMA, tier: "lite" as const };

function memoryStore(initial: Ledger = {}): LedgerStore & { saved: Ledger[] } {
  const saved: Ledger[] = [];
  let current: Ledger = initial;
  return { saved, async load() { return structuredClone(current); }, async save(l) { current = structuredClone(l); saved.push(current); } };
}

function makeRouter(env: Record<string, string>, net: ReturnType<typeof fakeNetwork>, extra: { store?: LedgerStore; now?: () => number; maxTotalWaitMs?: number; groundedFree?: boolean } = {}) {
  const sleeps: number[] = [];
  const logs: string[] = [];
  const router = new LlmRouter(buildSlots(env), {
    fetchFn: net.fn, store: extra.store, now: extra.now ?? (() => Date.UTC(2026, 9, 4, 12)),
    sleep: async (ms) => { sleeps.push(ms); }, log: (m) => logs.push(m), maxTotalWaitMs: extra.maxTotalWaitMs, groundedFree: extra.groundedFree,
  });
  return { router, sleeps, logs };
}

const FREE = { GEMINI_FREE_API_KEY: "g", GROQ_API_KEY: "q", OPENROUTER_API_KEY: "o", OPENROUTER_FREE_MODELS: "or-a:free,or-b:free" };

describe("router", () => {
  it("answers from the first provider with room", async () => {
    const net = fakeNetwork(() => gemini(GOOD));
    const { router } = makeRouter(FREE, net);
    const r = await router.json(REQ);
    expect(r.data).toEqual(GOOD);
    expect(r.via).toBe("gemini-free lite");
    expect(net.calls).toHaveLength(1);
    expect(net.calls[0].url).toContain("gemini-flash-lite-latest");
  });

  it("moves to the next provider on a rate limit, and remembers not to retry the first", async () => {
    const net = fakeNetwork((url) => (url.includes("googleapis") ? { status: 429, headers: { "retry-after": "30" }, text: "busy" } : openai(GOOD)));
    const { router } = makeRouter(FREE, net);
    const first = await router.json(REQ);
    expect(first.via).toBe("groq openai/gpt-oss-120b"); // after both Flash-Lite models said "busy"
    const second = await router.json(REQ);
    expect(second.via).toBe("groq openai/gpt-oss-120b");
    expect(net.count("googleapis")).toBe(2); // each asked once, then blocked, not asked again
  });

  it("walks the whole chain and reports failure when nobody can answer", async () => {
    const net = fakeNetwork(() => ({ status: 429, text: "Rate limit: requests per day (RPD)" }));
    const { router } = makeRouter(FREE, net);
    const r = await router.json(REQ);
    expect(r.data).toBeNull();
    expect(r.failure).toBe("rate-limited");
    const callsAfterFirst = net.calls.length;
    const again = await router.json(REQ);
    expect(again.failure).toBe("rate-limited");
    // Daily limits are remembered: the second request makes no calls except,
    // at most, the OpenRouter model that hadn't been tried (the daily limit
    // is account-wide, so none).
    expect(net.calls.length).toBe(callsAfterFirst);
  });

  it("treats an unusable answer as a reason to try the next provider", async () => {
    const net = fakeNetwork((url) => (url.includes("googleapis") ? { json: { candidates: [{ content: { parts: [{ text: "I cannot help" }] } }] } } : openai(GOOD)));
    const { router } = makeRouter(FREE, net);
    const r = await router.json(REQ);
    expect(r.via).toBe("groq openai/gpt-oss-120b");
    expect(r.attempts[0]).toMatch(/invalid answer/);
  });

  it("answers from Gemma, through the same Gemini endpoint with a response schema", async () => {
    const net = fakeNetwork((url) => (url.includes("gemma") ? gemini(GOOD) : { status: 429, text: "busy" }));
    const { router } = makeRouter({ GEMINI_FREE_API_KEY: "g" }, net);
    const r = await router.json(REQ);
    expect(r.via).toBe("gemini-free gemma31");
    const call = net.calls.find((c) => c.url.includes("gemma-4-31b-it"))!;
    expect((call.body.generationConfig as Record<string, unknown>).responseSchema).toBeDefined();
    expect((call.body.generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined();
  });

  it("offers the strong Flash models only to high-priority work, and first", async () => {
    const net = fakeNetwork(() => gemini(GOOD));
    const std = { ...REQ, tier: "standard" as const };
    const high = await makeRouter({ GEMINI_FREE_API_KEY: "g" }, net).router.json({ ...std, priority: "high" });
    expect(high.via).toBe("gemini-free flash38");
    expect(net.calls[0].url).toContain("gemini-3.8-flash");
    expect((net.calls[0].body.generationConfig as Record<string, unknown>).thinkingConfig).toEqual({ thinkingBudget: 0 });
    const normal = await makeRouter({ GEMINI_FREE_API_KEY: "g" }, net).router.json(std);
    expect(normal.via).toBe("gemini-free lite"); // never a Flash model
  });

  it("moves through the four Flash models as each reaches its 20 a day", async () => {
    const net = fakeNetwork(() => gemini(GOOD));
    const { router } = makeRouter({ GEMINI_FREE_API_KEY: "g", GEMINI_FREE_FLASH_RPD: "2", GEMINI_FREE_FLASH_RPM: "1000" }, net);
    const used: string[] = [];
    for (let i = 0; i < 5; i++) used.push((await router.json({ ...REQ, tier: "standard", priority: "high" })).via ?? "none");
    // 95% of 2 allows 1 each.
    expect(used.slice(0, 4)).toEqual(["gemini-free flash38", "gemini-free flash37", "gemini-free flash36", "gemini-free flash35"]);
    expect(used[4]).toBe("gemini-free lite");
  });

  it("rejects an answer that doesn't fit the schema", async () => {
    const net = fakeNetwork(() => openai({ commentary: "missing tags" }));
    const { router } = makeRouter({ GROQ_API_KEY: "q" }, net);
    const r = await router.json(REQ);
    expect(r.data).toBeNull();
    expect(r.failure).toBe("invalid");
  });

  it("is 'rate-limited', not 'invalid', when some slots had no room", async () => {
    const net = fakeNetwork((url) => (url.includes("groq") ? { status: 429, text: "slow" } : openai("not json")));
    const { router } = makeRouter({ GROQ_API_KEY: "q", OPENROUTER_API_KEY: "o", OPENROUTER_FREE_MODELS: "or-a:free" }, net);
    expect((await router.json(REQ)).failure).toBe("rate-limited");
  });

  it("retries without JSON mode when a free model rejects it", async () => {
    let n = 0;
    const net = fakeNetwork((_url, body) => (body.response_format && n++ === 0 ? { status: 400, text: "response_format is not supported" } : openai(GOOD)));
    const { router } = makeRouter({ OPENROUTER_API_KEY: "o", OPENROUTER_FREE_MODELS: "or-a:free" }, net);
    expect((await router.json(REQ)).data).toEqual(GOOD);
    expect(net.calls).toHaveLength(2);
    expect(net.calls[1].body.response_format).toBeUndefined();
  });

  it("reads provider errors reported inside a 200 answer, and tries the next model", async () => {
    const net = fakeNetwork((_url, body) => (body.model === "or-a:free" ? { json: { error: { code: 429, message: "slow down" } } } : openai(GOOD)));
    const { router } = makeRouter({ OPENROUTER_API_KEY: "o", OPENROUTER_FREE_MODELS: "or-a:free,or-b:free" }, net);
    const r = await router.json(REQ);
    expect(r.via).toBe("openrouter or-b:free");
    expect(r.attempts[0]).toMatch(/or-a:free: rate-limited/);
  });

  it("stops asking a model that no longer exists", async () => {
    const net = fakeNetwork((url) => (url.includes("groq") ? { status: 404, text: "model_not_found" } : openai(GOOD)));
    const { router } = makeRouter({ GROQ_API_KEY: "q", OPENROUTER_API_KEY: "o", OPENROUTER_FREE_MODELS: "or-a:free" }, net);
    await router.json(REQ);
    await router.json(REQ);
    expect(net.count("groq")).toBe(2); // each of the two Groq lite models asked once, then blocked
  });

  it("keeps low-priority work to a share of the day, so important work still has room", async () => {
    const net = fakeNetwork(() => gemini(GOOD));
    const { router } = makeRouter({ GEMINI_FREE_API_KEY: "g", GEMINI_FREE_LITE_RPD: "10", GEMINI_FREE_LITE_RPM: "1000", LLM_DISABLE: "lite31,gemma" }, net);
    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) results.push(!!(await router.json({ ...REQ, priority: "low" })).data);
    expect(results).toEqual([true, true, true, true, true, true, false]);
    expect(!!(await router.json({ ...REQ, priority: "high" })).data).toBe(true);
  });

  it("never spends the paid key unless allowed, and never past its cap", async () => {
    const net = fakeNetwork(() => gemini(GOOD));
    const noPaid = makeRouter({ GEMINI_API_KEY: "p" }, net).router;
    expect(noPaid.hasFreeSlots()).toBe(false);
    expect((await noPaid.json(REQ)).failure).toBe("none");
    expect(net.calls).toHaveLength(0);

    const { router } = makeRouter({ GEMINI_API_KEY: "p", LLM_PAID_DAILY_CALLS: "2" }, net);
    const outcomes = [];
    for (let i = 0; i < 4; i++) outcomes.push(!!(await router.json({ ...REQ, priority: "high" })).data);
    expect(outcomes.filter(Boolean).length).toBeLessThanOrEqual(2);
  });

  it("remembers the day's usage across runs through the store", async () => {
    const store = memoryStore();
    const env = { GEMINI_FREE_API_KEY: "g", GEMINI_FREE_LITE_RPD: "4", GEMINI_FREE_LITE_RPM: "1000", LLM_DISABLE: "lite31,gemma" };
    const net = fakeNetwork(() => gemini(GOOD));
    const run1 = makeRouter(env, net, { store }).router;
    for (let i = 0; i < 3; i++) expect((await run1.json(REQ)).data).toBeTruthy();
    const run2 = makeRouter(env, net, { store }).router;
    expect((await run2.json(REQ)).data).toBeNull(); // 3 of floor(4 x 0.85) = 3 already used
    expect(net.calls).toHaveLength(3);
  });

  it("starts a new quota day with fresh budgets", async () => {
    let t = Date.UTC(2026, 9, 4, 12);
    const net = fakeNetwork(() => gemini(GOOD));
    const { router } = makeRouter({ GEMINI_FREE_API_KEY: "g", GEMINI_FREE_LITE_RPD: "2", GEMINI_FREE_LITE_RPM: "1000", LLM_DISABLE: "lite31,gemma" }, net, { now: () => t });
    expect((await router.json(REQ)).data).toBeTruthy();
    expect((await router.json(REQ)).data).toBeNull(); // floor(2 x 0.85) = 1
    t += 24 * 3_600_000;
    expect((await router.json(REQ)).data).toBeTruthy();
  });

  it("keeps working when the store is broken or slow to fail", async () => {
    const broken: LedgerStore = { load: async () => { throw new Error("db down"); }, save: async () => { throw new Error("db down"); } };
    const { router } = makeRouter(FREE, fakeNetwork(() => gemini(GOOD)), { store: broken });
    expect((await router.json(REQ)).data).toEqual(GOOD);
  });

  // One provider, one model, one request a minute: the simplest way to make a wait.
  const ONE_A_MINUTE = { OPENROUTER_API_KEY: "o", OPENROUTER_FREE_MODELS: "or-a:free", OPENROUTER_RPM: "1" };

  it("moves on rather than waiting a long time for a per-minute limit", async () => {
    const net = fakeNetwork(() => openai(GOOD));
    const { router, sleeps } = makeRouter(ONE_A_MINUTE, net);
    expect((await router.json(REQ)).data).toBeTruthy();
    const second = await router.json(REQ); // the same minute: a ~60s wait, over the 25s limit
    expect(second.data).toBeNull();
    expect(second.attempts.join(" ")).toMatch(/busy/);
    expect(sleeps).toEqual([]);
  });

  it("waits a short while for a per-minute limit, but never past the run's total allowance", async () => {
    let t = Date.UTC(2026, 9, 4, 12);
    const patient = makeRouter(ONE_A_MINUTE, fakeNetwork(() => openai(GOOD)), { now: () => t });
    await patient.router.json(REQ);
    t += 40_000; // 20s left in the minute
    expect((await patient.router.json(REQ)).data).toBeTruthy();
    expect(patient.sleeps).toEqual([20_000]);

    t = Date.UTC(2026, 9, 4, 12);
    const capped = makeRouter(ONE_A_MINUTE, fakeNetwork(() => openai(GOOD)), { now: () => t, maxTotalWaitMs: 5_000 });
    await capped.router.json(REQ);
    t += 40_000;
    expect((await capped.router.json(REQ)).data).toBeNull();
    expect(capped.sleeps).toEqual([]);
  });

  const SEARCH_REPLY = { json: { candidates: [{ content: { parts: [{ text: "FACT: one" }] }, groundingMetadata: { groundingChunks: [{ web: { title: "mlb.com" } }] } }], usageMetadata: { totalTokenCount: 50 } } };

  it("answers web-grounded research on the paid Gemini slot only, returning the sources", async () => {
    const net = fakeNetwork((url, body) => (url.includes("googleapis") ? SEARCH_REPLY : openai(body)));
    const { router } = makeRouter({ ...FREE, GEMINI_API_KEY: "p", LLM_PAID_DAILY_CALLS: "5" }, net);
    const r = await router.grounded({ prompt: "research" });
    expect(r?.text).toBe("FACT: one");
    expect(r?.chunks).toEqual([{ web: { title: "mlb.com" } }]);
    expect(net.calls).toHaveLength(1);
    expect(net.calls[0].body.tools).toEqual([{ google_search: {} }]);
    expect(net.calls[0].url).toContain("gemini-flash-latest");
    expect((net.calls[0].body.generationConfig as Record<string, unknown>).responseSchema).toBeUndefined();
    expect(net.count("groq")).toBe(0);
  });

  it("skips web research, without spending a request, when there is no paid slot (the free project has no Search grounding)", async () => {
    const net = fakeNetwork(() => SEARCH_REPLY);
    const { router } = makeRouter(FREE, net);
    expect(await router.grounded({ prompt: "research" })).toBeNull();
    expect(net.calls).toHaveLength(0);
  });

  it("can try the free Gemini models for research when asked to", async () => {
    const net = fakeNetwork(() => SEARCH_REPLY);
    const { router } = makeRouter(FREE, net, { groundedFree: true });
    expect((await router.grounded({ prompt: "research" }))?.via).toBe("gemini-free flash38");
    expect(net.calls[0].url).toContain("gemini-3.8-flash");
  });

  it("keeps a refused search from blocking the same model's ordinary answers", async () => {
    const net = fakeNetwork((_url, body) => (body.tools ? { status: 429, text: "quota exceeded" } : gemini(GOOD)));
    const { router } = makeRouter(FREE, net, { groundedFree: true });
    expect(await router.grounded({ prompt: "research" })).toBeNull();
    const r = await router.json({ ...REQ, tier: "standard", priority: "high" });
    expect(r.via).toBe("gemini-free flash38");
  });

  it("returns null for research when the paid slot is out of room, never trying other providers", async () => {
    const net = fakeNetwork(() => ({ status: 429, text: "per day" }));
    const { router } = makeRouter({ ...FREE, GEMINI_API_KEY: "p", LLM_PAID_DAILY_CALLS: "5" }, net);
    expect(await router.grounded({ prompt: "research" })).toBeNull();
    expect(net.count("groq") + net.count("openrouter")).toBe(0);
  });

  it("never throws, whatever the network does", async () => {
    const fn = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
    const router = new LlmRouter(buildSlots(FREE), { fetchFn: fn, sleep: async () => {}, log: () => {} });
    const r = await router.json(REQ);
    expect(r.data).toBeNull();
    expect(r.failure).toBe("rate-limited");
    expect(await router.grounded({ prompt: "x" })).toBeNull();
  });
});

describe("write-up number check", () => {
  const source = "Rays beat the Yankees 1-0. Drew Rasmussen struck out 10 in 8 innings; attendance was 40,542 on October 3, 2026.";

  it("accepts figures that are in the source, and short or year-like ones", () => {
    expect(ungroundedNumbers("Rasmussen struck out 10 in 8 innings before 40,542 fans in 2026.", source)).toEqual([]);
    expect(ungroundedNumbers("He was the 5th pitcher to do it and it took 2 hours.", source)).toEqual([]);
    expect(ungroundedNumbers("The 2025 season was different.", source)).toEqual([]);
  });

  it("flags figures that appear nowhere in the source", () => {
    expect(ungroundedNumbers("A crowd of 41,200 watched; he threw 112 pitches.", source)).toEqual(["41200", "112"]);
  });

  it("compares numbers regardless of commas", () => {
    expect(ungroundedNumbers("Attendance: 40542.", source)).toEqual([]);
  });
});
