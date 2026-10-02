import { ArticleView, articleMetadata } from "@/app/(en)/article/[slug]/ArticleView";

export const revalidate = 60;

// Declaring this (even empty) is what makes Next cache the route — see the
// English article page.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  return articleMetadata((await props.params).slug, "es");
}

// The English article page, in Spanish: same layout and sections, translated text
// and Spanish labels (see ArticleView's `locale`).
export default async function SpanishArticlePage(props: { params: Promise<{ slug: string }> }) {
  return <ArticleView slug={(await props.params).slug} locale="es" />;
}
