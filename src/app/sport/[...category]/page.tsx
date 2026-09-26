import { HomeView, homeMetadata } from "../../_home/HomeView";

// A sport section of the homepage, e.g. /sport/cricket or
// /sport/football/world-cup. Was /?category=x until 2026-09-26: reading
// searchParams forced the homepage to render on every visit (0.6-1.4s
// measured), and a query-string section can't be a separate cached page
// the client router will navigate to. Old /?category=x links redirect
// here permanently (middleware.ts).
export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ category: string[] }> };

export async function generateMetadata(props: Props) {
  const { category } = await props.params;
  return homeMetadata(category.join("/"));
}

export default async function SportPage(props: Props) {
  const { category } = await props.params;
  return <HomeView category={category.join("/")} />;
}
