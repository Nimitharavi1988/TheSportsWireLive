import { ScoresView, scoresMetadata } from "./ScoresView";

// Standard scoreboard (src/lib/scores/): one card design and one live/
// final/upcoming rule for every sport. Was 300s; 60s now that live games
// carry running scores and a clock — ScoresBoard also re-fetches every
// minute while anything is live.
export const revalidate = 60;

export const metadata = scoresMetadata();

export default async function ScoresPage(props: { searchParams: Promise<{ category?: string }> }) {
  return <ScoresView category={(await props.searchParams).category} />;
}
