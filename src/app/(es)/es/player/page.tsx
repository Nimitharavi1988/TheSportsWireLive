import { PlayerIndexView, playerIndexMetadata } from "@/app/(en)/player/PlayerIndexView";

// Re-rendered hourly, not built once: the edition-wide robots setting
// (layout.tsx) is read at render time, and a page built before the edition
// went live kept "noindex, nofollow" for good (found 2026-10-04).
export const revalidate = 3600;

export const metadata = playerIndexMetadata("es");

export default function SpanishPlayerIndexPage() {
  return <PlayerIndexView locale="es" />;
}
