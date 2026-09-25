/**
 * Official YouTube channels whose videos we show. Channel ids were read from
 * each channel's own page and checked against its RSS feed title on
 * 2026-09-25 — never guessed: @F1 and @BCCI resolve to impostor channels
 * ("F1111" with no videos; a Shorts channel last active 2023), so neither is
 * listed. Add a channel only after the same check.
 *
 * `category` is the site's own sport category, used to match highlights to
 * match stories and to filter the Videos section on sport pages.
 */
export interface YouTubeChannel {
  id: string;
  title: string;
  category: string;
}

export const YOUTUBE_CHANNELS: YouTubeChannel[] = [
  { id: "UCDVYQ4Zhbm3S2dlz7P1GBDg", title: "NFL", category: "american-football" },
  { id: "UCWJ2lWNubArHWmf3FIHbfcQ", title: "NBA", category: "basketball" },
  { id: "UCoLrcjPV5PbUrUyXq5mjc_A", title: "MLB", category: "baseball" },
  { id: "UCqFMzb-4AUf6WAIbl132QKA", title: "NHL", category: "hockey" },
  { id: "UCG5qGWdu8nIRZqJ_GgDwQ-w", title: "Premier League", category: "football" },
  { id: "UCTv-XvfzLX3i4IGWAm4sbmA", title: "LALIGA EA SPORTS", category: "football" },
  { id: "UC6UL29enLNe4mqwTfAyeNuw", title: "Bundesliga", category: "football" },
  { id: "UCBJeMCIeLQos7wacox4hmLQ", title: "Serie A", category: "football" },
  { id: "UCSZbXT5TLLW_i-5W8FZpFsg", title: "Major League Soccer", category: "football" },
  { id: "UCZ7wY7MRDSygp63HIEfdQZA", title: "Sky Sports Football", category: "football" },
  { id: "UCt2JXOLNxqry7B_4rRZME3Q", title: "ICC", category: "cricket" },
  { id: "UCkd4takjjF1EGD1TKIK2QiA", title: "Sky Sports Cricket", category: "cricket" },
];
