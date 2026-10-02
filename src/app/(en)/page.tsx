import { HomeView, homeMetadata } from "./_home/HomeView";

// Homepage, all sports. A cached page, re-rendered in the background every
// minute. Sport sections live at /sport/<category> (sport/[...category]).
export const revalidate = 60;

export function generateMetadata() {
  return homeMetadata();
}

export default function HomePage() {
  return <HomeView />;
}
