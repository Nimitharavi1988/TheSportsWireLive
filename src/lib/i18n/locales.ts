// One entry per site language (see PLAN.md, "Spanish-language site"). Adding a
// language = a new entry here + DNS for its host + a dictionary + glossary;
// the translation job, routing and SEO code all read this table, never a
// hard-coded "es".

export interface LocaleConfig {
  code: string;
  // Hostname the language is served on (Phase 2 middleware maps host -> locale).
  host: string;
  // Name for the translation prompt.
  promptName: string;
  // Sport categories (Article.category) worth translating for this audience.
  categories: string[];
  // Terms that must be rendered a fixed way; injected into the prompt.
  glossary: string[];
  // Headlines mentioning these jump the translation queue (this audience's
  // clubs/leagues/players), so the best-fit stories are translated first
  // when the per-run cap bites.
  priorityTerms: string[];
  // Max NEW translations per sport per rolling 24h. The English site publishes
  // ~700 stories a day in these sports (about half NFL), far more than a
  // Spanish front page needs; caps keep the site balanced across sports and
  // bound the Gemini spend. A sport not listed is uncapped.
  dailyCaps: Record<string, number>;
  // One-off backfill (TRANSLATE_BACKFILL=1): max translations per sport for the
  // whole run, replacing dailyCaps. Sized so a launch has depth in every sport
  // without drowning the thin ones in NFL/baseball.
  backfillCaps: Record<string, number>;
}

export const LOCALES: Record<string, LocaleConfig> = {
  es: {
    code: "es",
    host: "es.sportswirelive.com",
    promptName: "NEUTRAL Spanish for a mixed audience of US Hispanic, Latin American and Spanish readers (no regional slang)",
    categories: ["football", "football/world-cup", "basketball", "baseball", "american-football", "formula-1", "athletics"],
    glossary: [
      'soccer -> "fútbol"; NFL / American football -> "fútbol americano"; baseball -> "béisbol"; basketball -> "baloncesto"',
      'match preview articles ("Preview: A vs B — date") -> "Previa: A vs B — date" (always "Previa", feminine)',
      'Formula 1 -> "Fórmula 1" (with accent); "long runs" (F1) -> "tandas largas"; "pole position" stays "pole position"; "Grand Prix" -> "Gran Premio"',
      'Never write "Los Los Angeles": team names that already start with "Los"/"Las"/"El" take no extra article',
      "Keep clock times and time zones as written (e.g. 7:00 PM UTC); translate month names (Oct -> oct.)",
    ],
    backfillCaps: { football: 400, "football/world-cup": 60, basketball: 200, "formula-1": 150, athletics: 100, baseball: 250, "american-football": 300 },
    dailyCaps: { football: 120, "football/world-cup": 40, basketball: 60, "formula-1": 40, athletics: 20, baseball: 40, "american-football": 60 },
    priorityTerms: [
      "la liga", "real madrid", "barcelona", "barça", "atlético", "atletico", "sevilla", "valencia", "villarreal", "athletic club",
      "liga mx", "mexico", "méxico", "argentina", "brazil", "brasil", "colombia", "uruguay", "chile",
      "messi", "vinicius", "vinícius", "yamal", "mbappé", "mbappe", "lewandowski", "alcaraz", "sainz", "alonso",
      "world cup", "champions league", "copa", "mls", "inter miami",
    ],
  },
};

// Kill switch: TRANSLATION_LOCALES="es" (comma list) turns the job on for those
// languages; unset/empty = the job does nothing. Lets the code ship dormant.
export function enabledLocales(env: string | undefined = process.env.TRANSLATION_LOCALES): LocaleConfig[] {
  return (env ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((c) => c in LOCALES)
    .map((c) => LOCALES[c]);
}
