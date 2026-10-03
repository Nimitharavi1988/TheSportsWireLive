import { PlayerView, playerMetadata } from "./PlayerView";

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return playerMetadata((await params).slug);
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  return <PlayerView slug={(await params).slug} />;
}
