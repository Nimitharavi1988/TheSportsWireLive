import { StandingsView, standingsMetadata } from "./StandingsView";

// Standings change daily; was static since the last deploy (no revalidate).
export const revalidate = 3600;

export const metadata = standingsMetadata();

export default async function StandingsIndexPage() {
  return <StandingsView />;
}
