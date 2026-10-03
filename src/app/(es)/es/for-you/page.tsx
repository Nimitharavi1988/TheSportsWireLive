import { ForYouView, forYouMetadata } from "@/app/(en)/for-you/ForYouView";

export const dynamic = "force-dynamic";

export const metadata = forYouMetadata("es");

export default async function SpanishForYouPage({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  return <ForYouView only={(await searchParams).only} locale="es" />;
}
