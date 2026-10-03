"use client";

import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";

export interface EditionLink {
  code: string;
  origin: string;
  name: string;
  categories: string[];
}

// One link per live language edition in the English header bar — shown only when
// the bar has room (>= 1240px; narrower, the same links are in the More Sports
// menu and the phone drawer, see SiteHeader) so it can never push the menu onto
// a second row. (See
// lib/i18n/liveLocales.ts). On a sport page it goes to the same sport in that
// edition when it covers it; anywhere else (an article has its own "read in"
// link) it goes to the edition's home.
export function editionHref(e: EditionLink, pathname: string): string {
  const category = pathname.startsWith("/sport/") ? pathname.slice("/sport/".length) : null;
  return category && e.categories.includes(category) ? `${e.origin}/sport/${category}` : `${e.origin}/`;
}

export function LanguageSwitch({ editions }: { editions: EditionLink[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <>
      {editions.map((e) => {
        const href = editionHref(e, pathname);
        return (
          <Box
            key={e.code}
            component="a"
            href={href}
            hrefLang={e.code}
            lang={e.code}
            sx={{ display: "none", "@media (min-width: 1240px)": { display: "inline" }, fontSize: 14, fontWeight: 600, color: "text.secondary", textDecoration: "none", px: 1, "&:hover": { color: "primary.main" } }}
          >
            {e.name}
          </Box>
        );
      })}
    </>
  );
}
