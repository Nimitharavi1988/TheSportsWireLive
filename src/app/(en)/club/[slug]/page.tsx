import { ClubView, clubMetadata } from "./ClubView";

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return clubMetadata((await params).slug);
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ClubView slug={(await params).slug} />;
}
