import { ForYouView, forYouMetadata } from "./ForYouView";

export const dynamic = "force-dynamic";

export const metadata = forYouMetadata();

export default async function ForYouPage({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  return <ForYouView only={(await searchParams).only} />;
}
