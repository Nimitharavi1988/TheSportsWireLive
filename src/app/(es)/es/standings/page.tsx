import { StandingsView, standingsMetadata } from "@/app/(en)/standings/StandingsView";

export const revalidate = 3600;

export const metadata = standingsMetadata("es");

export default async function SpanishStandingsPage() {
  return <StandingsView locale="es" />;
}
