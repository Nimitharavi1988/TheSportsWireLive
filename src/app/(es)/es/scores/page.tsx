import { ScoresView, scoresMetadata } from "@/app/(en)/scores/ScoresView";

export const revalidate = 60;

export const metadata = scoresMetadata("es");

// The English scoreboard, in Spanish and limited to the Spanish edition's sports.
export default async function SpanishScoresPage(props: { searchParams: Promise<{ category?: string }> }) {
  return <ScoresView category={(await props.searchParams).category} locale="es" />;
}
