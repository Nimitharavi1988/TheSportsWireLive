/**
 * Validation rules (pure, unit-tested) for what fans can send us: a match
 * rating, a private site-feedback note, and a Fan Voices take. Everything a
 * visitor types is checked here before it is stored; anything shown publicly
 * is also reviewed by a person in admin.
 */
import { containsProfanity } from "./profanity";

export const NOTE_MAX = 300;
export const VOICE_MIN_WORDS = 8;
export const VOICE_MAX_WORDS = 150;
export const VOICE_MAX_CHARS = 900;
export const NAME_MAX = 30;
export const COUNTRY_MAX = 30;
// Per anonymous visitor per day, across all their notes / takes.
export const MAX_FEEDBACK_PER_DAY = 3;
export const MAX_VOICES_PER_DAY = 3;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function wordCount(text: string): number {
  return text ? text.split(" ").length : 0;
}

// Links, email addresses and long digit runs (phone numbers): no advertising,
// and no personal contact details published or stored by accident.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|uk|me|ly|gg|tv|xyz|info|ru|cn|biz|shop|site|link)\b)/i;
const EMAIL = /\S+@\S+\.\S+/;
const LONG_DIGITS = /\d[\d\s().-]{6,}\d/;

export function hasContactOrLink(text: string): boolean {
  return LINK.test(text) || EMAIL.test(text) || LONG_DIGITS.test(text);
}

export function checkRating(value: unknown): Checked<number> {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? { ok: true, value: n } : { ok: false, error: "Rating must be 1 to 5" };
}

export interface FeedbackInput {
  sentiment: "up" | "down";
  note: string | null;
  page: string | null;
}

export function checkFeedback(body: { sentiment?: unknown; note?: unknown; page?: unknown; website?: unknown } | null): Checked<FeedbackInput> {
  if (!body) return { ok: false, error: "Invalid request" };
  // Honeypot: a field real visitors never see. Bots fill it; pretend success upstream.
  if (cleanText(body.website)) return { ok: false, error: "spam" };
  if (body.sentiment !== "up" && body.sentiment !== "down") return { ok: false, error: "Choose thumbs up or down" };
  const note = cleanText(body.note);
  if (note.length > NOTE_MAX) return { ok: false, error: `Please keep it under ${NOTE_MAX} characters` };
  if (note && (hasContactOrLink(note) || containsProfanity(note).flagged)) {
    return { ok: false, error: "Please remove links, contact details and strong language" };
  }
  const page = cleanText(body.page);
  return { ok: true, value: { sentiment: body.sentiment, note: note || null, page: page.startsWith("/") ? page.slice(0, 200) : null } };
}

export interface VoiceInput {
  name: string;
  country: string | null;
  body: string;
}

export function checkVoice(input: { name?: unknown; country?: unknown; body?: unknown; website?: unknown } | null): Checked<VoiceInput> {
  if (!input) return { ok: false, error: "Invalid request" };
  if (cleanText(input.website)) return { ok: false, error: "spam" };
  const name = cleanText(input.name);
  const country = cleanText(input.country);
  const body = cleanText(input.body);

  if (name.length < 2 || name.length > NAME_MAX) return { ok: false, error: `Please add a first name (2 to ${NAME_MAX} characters)` };
  if (country.length > COUNTRY_MAX) return { ok: false, error: "Country is too long" };
  const words = wordCount(body);
  if (words < VOICE_MIN_WORDS) return { ok: false, error: `Please write at least ${VOICE_MIN_WORDS} words` };
  if (words > VOICE_MAX_WORDS || body.length > VOICE_MAX_CHARS) return { ok: false, error: `Please keep it to ${VOICE_MAX_WORDS} words` };

  for (const field of [name, country, body]) {
    if (hasContactOrLink(field)) return { ok: false, error: "Please remove links and contact details" };
    if (containsProfanity(field).flagged) return { ok: false, error: "Please remove strong language" };
  }
  return { ok: true, value: { name, country: country || null, body } };
}
