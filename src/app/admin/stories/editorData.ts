import { CATEGORY_META } from "@/lib/categoryMeta";
import { categoryChipStyle } from "@/lib/categoryDisplay";

// The sports a story can be filed under, as editor menu options.
export function storyCategories(): { value: string; label: string }[] {
  return Object.keys(CATEGORY_META).map((value) => ({
    value,
    label: value.includes("/") ? CATEGORY_META[value].title.split(",")[0] : categoryChipStyle(value).label,
  }));
}
