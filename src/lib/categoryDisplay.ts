// Readable label + a distinct (but still muted/brand-consistent) accent color
// per category, so cards are scannable by sport at a glance rather than all
// showing the same plain outlined chip regardless of category. Shared across
// the homepage and article pages — was duplicated per-page before.
// `emoji` leads social posts (was three separate copies in facebook.ts,
// instagram.ts and socialPoster.ts) — one registry, so a new sport is
// added once.
const CATEGORY_CHIP: Record<string, { label: string; color: string; emoji?: string }> = {
  football: { label: "Football", color: "#1d6b3f", emoji: "⚽" },
  "football/world-cup": { label: "World Cup", color: "#3d5a73" },
  // #935b20 (was #b8752e, 3.7:1 on white): 5.6:1, readable as small text.
  cricket: { label: "Cricket", color: "#935b20", emoji: "🏏" },
  "american-football": { label: "NFL", color: "#6b3fa0", emoji: "🏈" },
  "college-football": { label: "College Football", color: "#8e2a2a", emoji: "🏈" },
  athletics: { label: "Athletics", color: "#a02b5c", emoji: "🏃" },
  baseball: { label: "MLB", color: "#c0392b", emoji: "⚾" },
  basketball: { label: "NBA", color: "#e67e22", emoji: "🏀" },
  wnba: { label: "WNBA", color: "#127369", emoji: "🏀" },
  rugby: { label: "Rugby", color: "#2e7d5b", emoji: "🏉" },
  hockey: { label: "NHL", color: "#1a5276", emoji: "🏒" },
  volleyball: { label: "Volleyball", color: "#8e44ad", emoji: "🏐" },
  "formula-1": { label: "Formula 1", color: "#b7950b", emoji: "🏎️" },
  tennis: { label: "Tennis", color: "#5d8a1f", emoji: "🎾" },
  boxing: { label: "Boxing", color: "#a93226", emoji: "🥊" },
  mma: { label: "MMA", color: "#4a4a4a", emoji: "🥋" },
  motogp: { label: "MotoGP", color: "#d35400", emoji: "🏍️" },
  cycling: { label: "Cycling", color: "#2471a3", emoji: "🚴" },
  golf: { label: "Golf", color: "#1e8449", emoji: "⛳" },
  padel: { label: "Padel", color: "#17a2b8", emoji: "🎾" },
};

export function categoryChipStyle(category: string) {
  return CATEGORY_CHIP[category] ?? { label: category, color: "#6b6b6b" };
}

export function categoryEmoji(category: string): string {
  return CATEGORY_CHIP[category]?.emoji ?? "🏆";
}
