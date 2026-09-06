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
    h1: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h2: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h3: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h4: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h5: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h6: { fontFamily: "var(--font-heading)", fontWeight: 700 },
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
