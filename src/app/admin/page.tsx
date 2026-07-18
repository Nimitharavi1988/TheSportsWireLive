import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { approveArticle, rejectArticle } from "./actions";

export default async function AdminQueuePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const pending = await db.article.findMany({
    where: { status: "pending_review" },
    orderBy: { createdAt: "desc" },
  });

  const flagged = await db.article.findMany({
    where: { status: "flagged" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <main className="admin-page">
      <h1>Review queue ({pending.length} pending)</h1>

      {pending.length === 0 && <p className="empty-state">Nothing waiting for review right now.</p>}

      {pending.map((article) => (
        <div key={article.id} className="admin-card">
          <div className="admin-card__meta">
            {article.category} · {article.sourceName}
            {article.readabilityScore != null &&
              article.readabilityScore < 40 &&
              " · ⚠ low readability score"}
          </div>
          <h2 className="admin-card__title">{article.title}</h2>
          <p className="admin-card__summary">{article.summary}</p>
          <a href={article.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            Source ↗
          </a>
          <div className="admin-actions">
            <form action={approveArticle.bind(null, article.id)}>
              <button type="submit" className="btn btn-approve">Approve</button>
            </form>
            <form action={rejectArticle.bind(null, article.id, undefined)}>
              <button type="submit" className="btn btn-reject">Reject</button>
            </form>
          </div>
        </div>
      ))}

      {flagged.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 32 }}>Flagged by automated checks</h2>
          <p style={{ fontSize: 13, color: "#888" }}>
            These failed the profanity or readability check and never reached the
            queue above. Shown here so you can spot patterns and tune the filters.
          </p>
          {flagged.map((article) => (
            <div key={article.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid #eee" }}>
              {article.title} — {article.profanityFlag ? "profanity" : "readability"}
            </div>
          ))}
        </>
      )}
    </main>
  );
}