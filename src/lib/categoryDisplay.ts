// Readable label + a distinct (but still muted/brand-consistent) accent color
// per category, so cards are scannable by sport at a glance rather than all
// showing the same plain outlined chip regardless of category. Shared across
// the homepage and article pages — was duplicated per-page before.
const CATEGORY_CHIP: Record<string, { label: string; color: string }> = {
  football: { label: "Football", color: "#1d6b3f" },
  "football/world-cup": { label: "World Cup", color: "#3d5a73" },
  cricket: { label: "Cricket", color: "#b8752e" },
  "american-football": { label: "NFL", color: "#6b3fa0" },
  athletics: { label: "Athletics", color: "#a02b5c" },
  baseball: { label: "MLB", color: "#c0392b" },
  basketball: { label: "NBA", color: "#e67e22" },
  rugby: { label: "Rugby", color: "#2e7d5b" },
};

export function categoryChipStyle(category: string) {
  return CATEGORY_CHIP[category] ?? { label: category, color: "#6b6b6b" };
}
