import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Link from "next/link";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { article, author } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { ORIGINAL_SOURCE } from "@/lib/stories";
import { categoryChipStyle } from "@/lib/categoryDisplay";

export const metadata = { title: "Stories", robots: { index: false } };

// The site's own writing: drafts, published originals, and ingested stories
// an editor rewrote under their byline.
export default async function StoriesPage() {
  if (!(await getSession())) redirect("/admin/login");
  const rows = await db
    .select({ id: article.id, title: article.title, status: article.status, category: article.category, sourceName: article.sourceName, updatedAt: article.updatedAt, slug: article.slug, authorName: author.name })
    .from(article)
    .leftJoin(author, eq(author.slug, article.authorSlug))
    .where(and(
      inArray(article.status, ["draft", "published"]),
      or(eq(article.sourceName, ORIGINAL_SOURCE), isNotNull(article.authorSlug))
    ))
    .orderBy(desc(article.updatedAt))
    .limit(200);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Link href="/admin" style={{ fontSize: 14 }}>← Review queue</Link>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mt: 1, mb: 3 }}>
        <Typography variant="h4">Stories</Typography>
        <Link href="/admin/stories/new"><Button variant="contained">Write a story</Button></Link>
      </Stack>
      {rows.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>
          No stories yet. Original pieces — previews, analysis, opinion — are what makes the site more than a news feed.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((r) => (
            <Card key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                <Chip size="small" label={r.status === "draft" ? "Draft" : "Published"} color={r.status === "draft" ? "default" : "success"} />
                <Chip size="small" variant="outlined" label={categoryChipStyle(r.category).label} />
                {r.sourceName !== ORIGINAL_SOURCE && <Chip size="small" variant="outlined" label={`Rewrite of ${r.sourceName}`} />}
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {r.authorName ? `${r.authorName} · ` : ""}{r.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Typography>
              </Stack>
              <Link href={`/admin/stories/${r.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                <Typography sx={{ fontWeight: 600 }}>{r.title}</Typography>
              </Link>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
