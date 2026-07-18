import { db } from "@/lib/db";
import Link from "next/link";

export const revalidate = 60;

export default async function HomePage() {
  const articles = await db.article.findMany({
    where: { status: "published" },
    orderBy: [{ trendingScore: "desc" }, { publishedAt: "desc" }],
    take: 30,
  });

  return (
    <main className="page">
      {articles.length === 0 && (
        <p className="empty-state">
          No articles published yet — approve some in /admin to see them here.
        </p>
      )}

      {articles.map((article) => {
        const bannerClass = article.category.startsWith("cricket")
          ? "cover-banner--cricket"
          : article.category === "football/euros"
          ? "cover-banner--euros"
          : article.category.startsWith("football")
          ? "cover-banner--football"
          : "cover-banner--default";

        return (
          <article key={article.id} className="article-card">
            <div className={`cover-banner ${bannerClass}`}>{article.category}</div>
            <div className="article-card__category">{article.category}</div>
            <h2 className="article-card__title">
              <Link href={`/article/${article.slug}`}>{article.title}</Link>
            </h2>
            <p className="article-card__summary">{article.summary}</p>
          </article>
        );
      })}
    </main>
  );
}