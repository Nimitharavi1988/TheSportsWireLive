import { StandingsLeagueView, leagueMetadata } from "@/app/(en)/standings/[code]/StandingsLeagueView";

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: { params: Promise<{ code: string }> }) {
  return leagueMetadata((await props.params).code, "es");
}

export default async function SpanishStandingsLeaguePage(props: { params: Promise<{ code: string }> }) {
  return <StandingsLeagueView code={(await props.params).code} locale="es" />;
}
