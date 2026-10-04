import { ClubIndexView, clubIndexMetadata } from "@/app/(en)/club/ClubIndexView";

// Re-rendered hourly for the same reason as es/player/page.tsx.
export const revalidate = 3600;

export const metadata = clubIndexMetadata("es");

export default function SpanishClubIndexPage() {
  return <ClubIndexView locale="es" />;
}
