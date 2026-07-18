import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article) return {};
  return { title: article.title, description: article.summary };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article || article.status !== "published") notFound();

  const bannerClass = article.category.startsWith("cricket")
    ? "cover-banner--cricket"
    : article.category.startsWith("football")
    ? "cover-banner--football"
    : "cover-banner--default";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.publishedAt,
    articleSection: article.category,
    description: article.summary,
  };

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={`cover-banner cover-banner--detail ${bannerClass}`}>{article.category}</div>
      <div className="article-detail__category">{article.category}</div>
      <h1 className="article-detail__title">{article.title}</h1>
      <p className="article-detail__summary">{article.summary}</p>
      <a className="article-detail__source" href={article.sourceUrl} target="_blank" rel="noreferrer">
        Original source: {article.sourceName} ↗
      </a>
    </main>
  );
}