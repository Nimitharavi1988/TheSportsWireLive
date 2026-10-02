"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getDict, type Dict } from "./dictionary";

// Client components read the page's language from here instead of taking a
// `locale` prop through every level. A language edition's root layout wraps its
// children in <LocaleProvider locale="es">; with no provider (the English site)
// the locale is undefined and everything renders English. Server components
// (and modules shared with them) receive `locale` as a prop instead — a client
// context cannot be read there.
const LocaleContext = createContext<string | undefined>(undefined);

export function LocaleProvider({ locale, children }: { locale?: string; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): string | undefined {
  return useContext(LocaleContext);
}

export function useDict(): Dict {
  return getDict(useLocale());
}
