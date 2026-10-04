/**
 * The AI providers the router can use, and which models serve which work
 * (2026-10-04). Aim: spend nothing. Every slot here is a free tier (or a
 * local model); a paid slot exists only when LLM_PAID_DAILY_CALLS is set above
 * 0, as a hard-capped last resort.
 *
 * Free limits, as published or reported on 2026-10-04 (they change without
 * notice, which is why the router also obeys each provider's own "too many
 * requests" answers, and every number can be overridden by an env var):
 *  - Gemini API free tier (a Google project WITHOUT billing): not published;
 *    commonly ~15 requests/min and ~1,000/day on Flash-Lite, ~10/min and
 *    ~250/day on Flash. Your real numbers: aistudio.google.com/rate-limit.
 *  - Groq: limits are per model: 30 requests/min, 1,000/day, 8,000
 *    tokens/min, 200,000 tokens/day each on gpt-oss-20b, gpt-oss-120b and
 *    qwen3.8-27b (console.groq.com/docs/rate-limits). Llama 3.x left the free
 *    tier on 16 Aug 2026.
 *  - OpenRouter free models: 20 requests/min and 50 requests/day for the
 *    whole account (1,000/day after a one-time $10 credit purchase).
 *  - Hugging Face's free tier is ~$0.10 a month: not used. Ollama is only
 *    used when OLLAMA_BASE_URL points at a machine that is on.
 */
import type { Limits } from "./ledger";

export type Tier = "lite" | "standard";

export type Provider = "gemini" | "openai";

// One provider/model that can answer. `budgetKey` is where its usage is
// counted: per model for Gemini and Groq, per account for OpenRouter.
export interface Slot {
  id: string;
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  model: string;
  tiers: Tier[];
  limits: Limits;
  budgetKey: string;
  resetHourUtc: number;
  paid: boolean;
  // Gemini Flash spends output tokens on hidden reasoning unless told not
  // to; Flash-Lite rejects that setting (see ingestion/commentary.ts).
  thinkingOff?: boolean;
  // OpenAI-style options.
  maxTokensParam?: "max_tokens" | "max_completion_tokens";
  reasoningEffort?: "low";
  extraHeaders?: Record<string, string>;
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : fallback;
};

export const GEMINI_LITE = "gemini-flash-lite-latest";
export const GEMINI_STANDARD = "gemini-flash-latest";

// Gemini's daily quota turns at midnight Pacific (07:00-08:00 UTC); Groq and
// OpenRouter at midnight UTC.
const GEMINI_RESET_HOUR_UTC = 8;

// LLM_DISABLE="groq,openrouter" switches providers off without a code change
// (a provider misbehaving, or a key to rotate): names are gemini-free, groq,
// openrouter, ollama, gemini-paid.
export function buildSlots(env: Record<string, string | undefined>, openRouterModels: string[] = []): Slot[] {
  const off = new Set((env.LLM_DISABLE ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  return buildAllSlots(env, openRouterModels).filter((s) => !off.has(s.id.split(" ")[0]));
}

function buildAllSlots(env: Record<string, string | undefined>, openRouterModels: string[]): Slot[] {
  const slots: Slot[] = [];
  const gemini = (key: string, id: string, model: string, tiers: Tier[], limits: Limits, paid: boolean, thinkingOff: boolean): Slot => ({
    id, provider: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", apiKey: key, model, tiers, limits,
    budgetKey: `${paid ? "gemini-paid" : "gemini-free"}/${model}`, resetHourUtc: GEMINI_RESET_HOUR_UTC, paid, thinkingOff,
  });

  const freeKey = env.GEMINI_FREE_API_KEY;
  if (freeKey) {
    slots.push(gemini(freeKey, "gemini-free lite", GEMINI_LITE, ["lite"], { rpm: num(env.GEMINI_FREE_LITE_RPM, 12), rpd: num(env.GEMINI_FREE_LITE_RPD, 1000) }, false, false));
    // Standard work only: Flash's small daily allowance is kept for the
    // researched reports and drafts, not spent on bulk summaries.
    slots.push(gemini(freeKey, "gemini-free flash", GEMINI_STANDARD, ["standard"], { rpm: num(env.GEMINI_FREE_FLASH_RPM, 8), rpd: num(env.GEMINI_FREE_FLASH_RPD, 250) }, false, true));
  }

  const groqKey = env.GROQ_API_KEY;
  if (groqKey) {
    const groq = (model: string, tiers: Tier[]): Slot => ({
      id: `groq ${model}`, provider: "openai", baseUrl: "https://api.groq.com/openai/v1", apiKey: groqKey, model, tiers,
      limits: { rpm: num(env.GROQ_RPM, 28), rpd: num(env.GROQ_RPD, 1000), tpm: num(env.GROQ_TPM, 8000), tpd: num(env.GROQ_TPD, 200000) },
      budgetKey: `groq/${model}`, resetHourUtc: 0, paid: false, maxTokensParam: "max_completion_tokens",
      ...(model.startsWith("openai/gpt-oss") ? { reasoningEffort: "low" as const } : {}),
    });
    // Each model has its own daily allowance: the small one takes bulk work,
    // the large one standard work, Qwen (good at Spanish) either.
    slots.push(groq("openai/gpt-oss-20b", ["lite"]));
    slots.push(groq("openai/gpt-oss-120b", ["standard"]));
    slots.push(groq("qwen/qwen3.8-27b", ["lite", "standard"]));
  }

  const orKey = env.OPENROUTER_API_KEY;
  if (orKey) {
    const orLimits: Limits = { rpm: num(env.OPENROUTER_RPM, 18), rpd: num(env.OPENROUTER_RPD, 50) };
    const configured = (env.OPENROUTER_FREE_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
    for (const model of (configured.length ? configured : openRouterModels).slice(0, 4)) {
      slots.push({
        id: `openrouter ${model}`, provider: "openai", baseUrl: "https://openrouter.ai/api/v1", apiKey: orKey, model, tiers: ["lite", "standard"],
        limits: orLimits, budgetKey: "openrouter", resetHourUtc: 0, paid: false, maxTokensParam: "max_tokens",
        extraHeaders: { "HTTP-Referer": env.SITE_URL ?? "https://sportswirelive.com", "X-Title": "Sports Wire Live" },
      });
    }
  }

  if (env.OLLAMA_BASE_URL) {
    const model = env.OLLAMA_MODEL ?? "llama3.1:8b";
    slots.push({
      id: `ollama ${model}`, provider: "openai", baseUrl: `${env.OLLAMA_BASE_URL.replace(/\/$/, "")}/v1`, apiKey: "ollama", model, tiers: ["lite"],
      limits: {}, budgetKey: "ollama", resetHourUtc: 0, paid: false, maxTokensParam: "max_tokens",
    });
  }

  // Hard-capped, off unless asked for: the billed Gemini project.
  const paidCalls = num(env.LLM_PAID_DAILY_CALLS, 0);
  if (paidCalls > 0 && env.GEMINI_API_KEY) {
    slots.push(gemini(env.GEMINI_API_KEY, "gemini-paid lite", GEMINI_LITE, ["lite"], { rpd: paidCalls }, true, false));
    slots.push(gemini(env.GEMINI_API_KEY, "gemini-paid flash", GEMINI_STANDARD, ["standard"], { rpd: paidCalls }, true, true));
  }
  return slots;
}

// The slots that may answer a request of this tier, in the order buildSlots
// lists them (best first), with any paid slot always last.
export function chainFor(slots: Slot[], tier: Tier): Slot[] {
  return slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.tiers.includes(tier))
    .sort((a, b) => Number(a.s.paid) - Number(b.s.paid) || a.i - b.i)
    .map(({ s }) => s);
}

// Free OpenRouter text models that can return JSON, best first, from its
// public model list (pure, unit-tested). The list changes every few weeks, so
// it is read at run time rather than hard-coded.
interface OpenRouterModel {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

export function pickOpenRouterFree(models: OpenRouterModel[]): string[] {
  const AVOID = /safety|guard|code|omni|preview|stealth|audio|image|vision|embed|lyria|content/i;
  const PREFER = /nemotron-3-super|qwen3|gemma-4|gpt-oss|llama-3\.3|deepseek/i;
  return models
    .filter((m) => m.id.endsWith(":free") && Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)
    .filter((m) => !AVOID.test(m.id) && (m.context_length ?? 0) >= 32_000)
    .filter((m) => (m.supported_parameters ?? []).some((p) => p === "response_format" || p === "structured_outputs"))
    .sort((a, b) => Number(PREFER.test(b.id)) - Number(PREFER.test(a.id))
      || Number((b.supported_parameters ?? []).includes("structured_outputs")) - Number((a.supported_parameters ?? []).includes("structured_outputs")))
    .map((m) => m.id);
}
