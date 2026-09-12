import { createTheme } from "@mui/material/styles";

// Carries the site's existing brand (green accent, Poppins/Inter) into
// Material Design components, rather than using MUI's default blue theme.
const theme = createTheme({
  palette: {
    primary: { main: "#1d6b3f" },
    background: { default: "#f7f7f5", paper: "#ffffff" },
    text: { primary: "#1a1a1a", secondary: "#6b6b6b" },
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
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44 },
      },
    },
  },
});

export default theme;
