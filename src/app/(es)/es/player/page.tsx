import { PlayerIndexView, playerIndexMetadata } from "@/app/(en)/player/PlayerIndexView";

export const metadata = playerIndexMetadata("es");

export default function SpanishPlayerIndexPage() {
  return <PlayerIndexView locale="es" />;
}
