// Colour themes for reels (reel.tsx), picked in admin next to the music.
// Plain data so the admin page can list them without pulling in the
// renderer. `accent` colours the sport tag, fact cards, underline and
// progress bar; `tint` is the dark shade behind text (RGB, used with
// varying opacity); `glow` lights the end card. The wordmark stays brand
// green on every theme.
export const REEL_THEMES = {
  green: { accent: "#12a35e", tint: [11, 23, 18], glow: "#173a2a" },
  blue: { accent: "#2f80ed", tint: [9, 17, 31], glow: "#16305a" },
  orange: { accent: "#f08a24", tint: [24, 15, 8], glow: "#4a2a10" },
  red: { accent: "#e5484d", tint: [24, 9, 11], glow: "#4a1519" },
  purple: { accent: "#8b5cf6", tint: [16, 11, 30], glow: "#2e1f5a" },
  gold: { accent: "#d4a72c", tint: [20, 17, 8], glow: "#4a3a12" },
} satisfies Record<string, { accent: string; tint: [number, number, number]; glow: string }>;

export type ReelTheme = keyof typeof REEL_THEMES;
export const REEL_THEME_NAMES = Object.keys(REEL_THEMES) as ReelTheme[];
export const DEFAULT_REEL_THEME: ReelTheme = "green";
