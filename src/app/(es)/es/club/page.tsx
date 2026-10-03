import { ClubIndexView, clubIndexMetadata } from "@/app/(en)/club/ClubIndexView";

export const metadata = clubIndexMetadata("es");

export default function SpanishClubIndexPage() {
  return <ClubIndexView locale="es" />;
}
