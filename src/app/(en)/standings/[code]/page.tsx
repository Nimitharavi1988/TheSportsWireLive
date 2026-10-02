import { StandingsLeagueView, leagueMetadata } from "./StandingsLeagueView";

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: { params: Promise<{ code: string }> }) {
  return leagueMetadata((await props.params).code);
}

export default async function StandingsPage(props: { params: Promise<{ code: string }> }) {
  return <StandingsLeagueView code={(await props.params).code} />;
}
