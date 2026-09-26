import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { article, author } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { isOriginalStory } from "@/lib/stories";
import { StoryEditor } from "../StoryEditor";
import { storyCategories, storySeriesOptions } from "../editorData";
import { tagOptions } from "@/lib/tags";
import { articleTag } from "@/db/schema";

export const metadata = { title: "Edit story", robots: { index: false } };

// Edits any story: an original one (draft or published) or an ingested one.
export default async function EditStoryPage(props: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) redirect("/admin/login");
  const { id } = await props.params;
  const [row] = await db.select().from(article).where(eq(article.id, id)).limit(1);
  if (!row) notFound();
  const [writer] = row.authorSlug ? await db.select().from(author).where(eq(author.slug, row.authorSlug)).limit(1) : [];
  const original = isOriginalStory(row);
  const tags = await db.select({ kind: articleTag.kind, slug: articleTag.slug }).from(articleTag).where(eq(articleTag.articleId, row.id));

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Link href="/admin/stories" style={{ fontSize: 14 }}>← Stories</Link>
      <Typography variant="h4" sx={{ mt: 1, mb: 3 }}>{original ? (row.status === "draft" ? "Draft" : "Edit story") : "Edit ingested story"}</Typography>
      <StoryEditor
        categories={storyCategories()}
        seriesOptions={await storySeriesOptions(row.seriesKey)}
        tagOptions={tagOptions()}
        initial={{
          id: row.id,
          slug: row.slug,
          status: row.status,
          title: row.title,
          summary: row.summary,
          body: row.body ?? "",
          category: row.category,
          storyKind: row.storyKind ?? "analysis",
          heroImageUrl: row.heroImageUrl,
          heroImageCredit: row.heroImageCredit,
          authorName: writer?.name ?? "",
          authorBio: writer?.bio ?? "",
          original,
          hasByline: Boolean(row.authorSlug),
          seriesKey: row.seriesKey,
          tags,
        }}
      />
    </Container>
  );
}
