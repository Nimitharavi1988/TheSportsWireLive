import { ArticleView, articleMetadata } from "./ArticleView";

export const revalidate = 60;

// Declaring this (even empty) is what makes Next cache this route: each
// page renders on its first visit, then is served from cache and
// re-rendered in the background every `revalidate` seconds. Without it,
// every visit rendered from scratch (measured 2026-09-26: up to 2.2s).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  return articleMetadata((await props.params).slug);
}

// The page itself lives in ArticleView.tsx so the Spanish edition can render the
// very same page (see (es)/es/article/[slug]/page.tsx).
export default async function ArticlePage(props: { params: Promise<{ slug: string }> }) {
  return <ArticleView slug={(await props.params).slug} />;
}
