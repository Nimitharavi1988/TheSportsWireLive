"use client";

import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";

// "Español" link in the English header (shown only when the Spanish site is
// switched on, see lib/i18n/esSite.ts). On a sport page it goes to the same
// sport on the Spanish site when that sport exists there; anywhere else (an
// article has its own "Leer en español" link) it goes to the Spanish home.
export function LanguageSwitch({ origin, categories }: { origin: string; categories: string[] }) {
  const pathname = usePathname() ?? "/";
  const category = pathname.startsWith("/sport/") ? pathname.slice("/sport/".length) : null;
  const href = category && categories.includes(category) ? `${origin}/sport/${category}` : `${origin}/`;
  return (
    <Box
      component="a"
      href={href}
      hrefLang="es"
      lang="es"
      sx={{ fontSize: 14, fontWeight: 600, color: "text.secondary", textDecoration: "none", px: 1, "&:hover": { color: "primary.main" } }}
    >
      Español
    </Box>
  );
}
