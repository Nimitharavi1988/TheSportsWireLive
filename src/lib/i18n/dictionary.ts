import { EN } from "./en";
import { ES } from "./es";

// All language-specific UI strings live in one Dict per language (en.ts is the
// reference). To add a language: copy en.ts, translate it, register it in DICTS
// below and add a LOCALES entry (locales.ts: host, sports, glossary). TypeScript
// then forces every key to be translated. Components never hold Spanish (or any
// other language) text — they take a `locale` and read it from here.

export interface Dict {
  htmlLang: string;
  ogLocale: string;
  /** Intl locale for dates, e.g. "en-US", "es-US". */
  dateLocale: string;
  siteName: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  /** Link to the English edition, shown on non-English sites. */
  otherSiteLabel: string;
  nav: {
    home: string;
    searchPlaceholder: string;
    searchButton: string;
    sections: string;
    moreSports: string;
    openMenu: string;
    /** Non-sport pages this edition has (href -> label); others are hidden from its menu until built. */
    pages: Record<string, string>;
  };
  /** Sports shown in this edition's navigation, in order (keys = Article.category). */
  sports: { category: string; label: string }[];
  /** Display name per category; a missing key falls back to the English label. */
  categoryLabels: Record<string, string>;
  time: { justNow: string; minutes: (n: number) => string; hours: (n: number) => string; days: (n: number) => string };
  home: {
    topStory: string;
    justIn: string;
    byCategory: string;
    byCompetition: string;
    transfers: string;
    matchResults: string;
    nflScores: string;
    playerNews: string;
    alsoInNews: string;
    alsoInNewsCaption: string;
    moreHeadlines: string;
    editorsPick: string;
    latest: string;
    bySport: string;
    empty: string;
    emptyCategory: string;
    emptyAdmin: string;
    noWorldCup: string;
    noWorldCupHint: string;
  };
  hero: { topStory: string; previous: string; next: string; goTo: (i: number, n: number) => string };
  article: {
    published: string;
    machineTranslated: string;
    readOriginal: string;
    reportIssue: string;
    originalSource: string;
    related: string;
    share: string;
  };
  section: { moreIn: string; empty: string };
  search: { title: string; results: string; none: string; prompt: string };
  footer: { rights: string; about: string; contact: string; privacy: string; terms: string; englishNote: string };
  notFound: { title: string; body: string; back: string };
  error: { title: string; body: string; retry: string };
}

const DICTS: Record<string, Dict> = { en: EN, es: ES };

/** The dictionary for a locale code; unknown or missing = English. */
export function getDict(locale?: string | null): Dict {
  return (locale && DICTS[locale]) || EN;
}
