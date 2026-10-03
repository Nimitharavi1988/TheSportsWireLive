"use client";

import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";

export interface EditionLink {
  code: string;
  origin: string;
  name: string;
  categories: string[];
}

// One link per live language edition in the English header (see
// lib/i18n/liveLocales.ts). On a sport page it goes to the same sport in that
// edition when it covers it; anywhere else (an article has its own "read in"
// link) it goes to the edition's home.
export function LanguageSwitch({ editions }: { editions: EditionLink[] }) {
  const pathname = usePathname() ?? "/";
  const category = pathname.startsWith("/sport/") ? pathname.slice("/sport/".length) : null;
  return (
    <>
      {editions.map((e) => {
        const href = category && e.categories.includes(category) ? `${e.origin}/sport/${category}` : `${e.origin}/`;
        return (
          <Box
            key={e.code}
            component="a"
            href={href}
            hrefLang={e.code}
            lang={e.code}
            sx={{ fontSize: 14, fontWeight: 600, color: "text.secondary", textDecoration: "none", px: 1, "&:hover": { color: "primary.main" } }}
          >
            {e.name}
          </Box>
        );
      })}
    </>
  );
}
