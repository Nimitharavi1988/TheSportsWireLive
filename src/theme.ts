import { createTheme } from "@mui/material/styles";

// Carries the site's existing brand (green accent, Poppins/Inter) into
// Material Design components, rather than using MUI's default blue theme.
const theme = createTheme({
  // Dark mode (2026-10-15): follows the visitor's browser/device setting through
  // a CSS media query only (no JavaScript, no flash, works with the cached pages).
  // Light is exactly the palette below as it always was; there is no toggle.
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    dark: {
      palette: {
        // Brand green, lightened: #0c7d45 is only 3.2:1 on a dark card (4.5 needed for text);
        // #3ecf8e is 8.3:1. Buttons with this background take dark text (9.4:1).
        primary: { main: "#3ecf8e", contrastText: "#07140d" },
        background: { default: "#121513", paper: "#1c201d" },
        text: { primary: "#ececec", secondary: "#a3a8a4", disabled: "#7d827e" },
        divider: "rgba(255, 255, 255, 0.12)",
      },
    },
    light: {
  palette: {
    // Was #1d6b3f -- real, verified against the site's own screenshots as
    // reading muted/corporate rather than vivid, a genuine contributor to
    // "the site looks dull" (2026-09-24). Same hue (still unmistakably
    // "this site's green," not a rebrand) but higher saturation/lightness
    // for real visual punch -- deliberately NOT a move toward dark mode or
    // a different accent color (e.g. neon/gold/red), which would go
    // against wanting to stay light and simple.
    //
    // #0c7d45, not the more vivid #0f9d58 first tried -- checked white-text
    // contrast (this color is used as button/chip backgrounds with white
    // text throughout) with the real WCAG relative-luminance formula, not
    // assumed: #0f9d58 only reaches 3.51:1 against white, under the 4.5:1
    // AA minimum for normal-size text (old #1d6b3f was a very safe 6.51:1).
    // #0c7d45 reaches 5.20:1 -- still a real step up in vividness, but
    // without trading accessibility for it.
    primary: { main: "#0c7d45" },
    background: { default: "#f7f7f5", paper: "#ffffff" },
    text: { primary: "#1a1a1a", secondary: "#6b6b6b", disabled: "#6e6e6e" },
  },
    },
  },
  typography: {
    fontFamily: "var(--font-body)",
    // No fontSize was ever set here — every heading fell back to MUI's own
    // defaults (h4 is 34px, h5 24px, h6 20px), which is why the hero title
    // (variant="h4") read as oversized. Meanwhile ~15 places across the
    // site had already independently landed on their own ad-hoc overrides
    // (fontSize: 17/18 for h6, mostly) to compensate, with no single source
    // of truth — a genuinely inconsistent scale, not just one big heading.
    // This is the site's real scale now; per-component overrides that just
    // duplicated one of these values were removed.
    h1: { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "2.25rem" }, // 36px
    h2: { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.875rem" }, // 30px
    h3: { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.625rem" }, // 26px
    h4: { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.5rem" }, // 24px — was defaulting to 34px
    h5: { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.25rem" }, // 20px
    h6: { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.125rem" }, // 18px — matches the ad-hoc value most components had already converged on
    button: { fontFamily: "var(--font-body)", textTransform: "none", fontWeight: 600 },
  },
  // Was 10 -- real request to move away from the soft, bubbly, rounded
  // feel toward something more angular/athletic. Not fully square (0):
  // confirmed live that some components (avatars, small icon buttons)
  // genuinely need to stay round regardless of this value and look broken
  // squared off, and it's applied via each component's own shape logic,
  // not this token, so this only affects cards/buttons/chips/inputs.
  shape: { borderRadius: 4 },
  // Motion rules: 150-300 ms with one gentle curve (matches --swl-motion-* in globals.css).
  transitions: {
    easing: { easeInOut: "cubic-bezier(0.2, 0, 0, 1)", easeOut: "cubic-bezier(0.2, 0, 0, 1)" },
    duration: { shortest: 150, shorter: 200, short: 250, standard: 250, complex: 300, enteringScreen: 200, leavingScreen: 150 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44 },
      },
    },
  },
});

export default theme;
