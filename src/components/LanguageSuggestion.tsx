"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

// One-time, dismissible suggestion for visitors whose browser prefers Spanish.
// Never redirects: it asks once, remembers the answer, and never asks again.
// Fixed to the bottom so showing it after mount causes no layout shift.
const KEY = "swl_lang_pref";

export interface SuggestEdition {
  code: string;
  origin: string;
  acceptLang: string;
  question: string;
  go: string;
  dismiss: string;
}

// Offers the first live edition whose language the browser lists first.
export function LanguageSuggestion({ editions }: { editions: SuggestEdition[] }) {
  const [match, setMatch] = useState<SuggestEdition | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
      const first = (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase();
      const hit = editions.find((e) => first.startsWith(e.acceptLang));
      if (hit) setMatch(hit);
    } catch {
      /* storage blocked: stay quiet */
    }
  }, [editions]);

  function answer(value: string) {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setMatch(null);
  }

  if (!match) return null;
  return (
    <Box
      role="region"
      aria-label={match.question}
      lang={match.code}
      sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1300, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider", boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", p: 1.5, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", justifyContent: "center" }}
    >
      <Typography sx={{ fontSize: 14 }}>{match.question}</Typography>
      <Button component="a" href={match.origin} hrefLang={match.code} size="small" variant="contained" onClick={() => answer(match.code)}>
        {match.go}
      </Button>
      <Button size="small" onClick={() => answer("en")}>
        {match.dismiss}
      </Button>
    </Box>
  );
}
