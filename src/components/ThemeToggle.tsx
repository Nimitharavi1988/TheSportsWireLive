"use client";

import IconButton from "@mui/material/IconButton";
import { useColorScheme } from "@mui/material/styles";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

// Manual light/dark switch. Until the visitor picks, the page follows the device setting;
// the choice is then remembered in localStorage by MUI. Before the client knows the mode
// it renders an empty box of the same size so the header does not shift.
export function ThemeToggle({ labels }: { labels?: { toDark: string; toLight: string } }) {
  const { mode, systemMode, setMode } = useColorScheme();
  const t = labels ?? { toDark: "Switch to dark mode", toLight: "Switch to light mode" };
  const resolved = mode === "system" ? systemMode : mode;
  if (!resolved) return <span style={{ width: 44, height: 44, flex: "none" }} aria-hidden />;
  const dark = resolved === "dark";
  return (
    <IconButton
      onClick={() => setMode(dark ? "light" : "dark")}
      aria-label={dark ? t.toLight : t.toDark}
      sx={{ width: 44, height: 44, color: "inherit" }}
    >
      {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
    </IconButton>
  );
}
