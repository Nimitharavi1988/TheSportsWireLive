import { ClubView, clubMetadata } from "@/app/(en)/club/[slug]/ClubView";

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return clubMetadata((await params).slug, "es");
}

export default async function SpanishClubPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ClubView slug={(await params).slug} locale="es" />;
}
