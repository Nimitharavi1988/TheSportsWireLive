import { PlayerView, playerMetadata } from "@/app/(en)/player/[slug]/PlayerView";

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return playerMetadata((await params).slug, "es");
}

export default async function SpanishPlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  return <PlayerView slug={(await params).slug} locale="es" />;
}
