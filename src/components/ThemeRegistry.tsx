"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "@/theme";

// Theme (and MUI's ThemeProvider) must live behind "use client" — the theme
// object contains functions (breakpoints.up/down/etc.), which Next.js can't
// serialize when passed as a prop from a Server Component across the
// client-boundary. Importing it here, inside the client file, avoids that.
export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
