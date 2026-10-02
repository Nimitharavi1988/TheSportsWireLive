"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

// One-time, dismissible suggestion for visitors whose browser prefers Spanish.
// Never redirects: it asks once, remembers the answer, and never asks again.
// Fixed to the bottom so showing it after mount causes no layout shift.
const KEY = "swl_lang_pref";

export function LanguageSuggestion({ origin }: { origin: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
      const first = (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase();
      if (first.startsWith("es")) setShow(true);
    } catch {
      /* storage blocked: stay quiet */
    }
  }, []);

  function answer(value: "es" | "en") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;
  return (
    <Box
      role="region"
      aria-label="Idioma"
      lang="es"
      sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1300, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider", boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", p: 1.5, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", justifyContent: "center" }}
    >
      <Typography sx={{ fontSize: 14 }}>¿Prefieres leer en español?</Typography>
      <Button component="a" href={origin} hrefLang="es" size="small" variant="contained" onClick={() => answer("es")}>
        Ir a la edición en español
      </Button>
      <Button size="small" onClick={() => answer("en")}>
        No, gracias
      </Button>
    </Box>
  );
}
