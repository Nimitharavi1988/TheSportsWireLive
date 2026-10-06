import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { article, dataSnapshot } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { ORIGINAL_SOURCE } from "@/lib/stories";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { reviewPackKey, type ReviewPack } from "@/lib/stories/autoDraftRules";
import { approveReviewedDraft } from "./actions";

export const metadata = { title: "Review drafts", robots: { index: false } };

// Auto-drafts saved clean with a review pack beside them (autoDraft.ts,
// reviewPack mode): read the story and the pack, then approve. Nothing is
// published until someone clicks Approve here.
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ error?: string; approved?: string }> }) {
  if (!(await getSession())) redirect("/admin/login");
  const { error, approved } = await searchParams;
  const drafts = await db
    .select()
    .from(article)
    .where(and(eq(article.sourceName, ORIGINAL_SOURCE), eq(article.status, "draft"), isNull(article.reviewedBy)))
    .orderBy(asc(article.createdAt))
    .limit(40);
  const packs = drafts.length
    ? await db.select({ key: dataSnapshot.key, data: dataSnapshot.data }).from(dataSnapshot).where(inArray(dataSnapshot.key, drafts.map((d) => reviewPackKey(d.id))))
    : [];
  const packOf = new Map(packs.map((p) => [p.key, p.data as ReviewPack]));
  // Only drafts saved with a pack (the older ones with [CHECK] notes in the
  // text still go through the normal editor).
  const reviewable = drafts.filter((d) => packOf.has(reviewPackKey(d.id)));
  const defaultByline = process.env.DRAFT_BYLINE_NAME ?? "";

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs steps={[{ name: "Admin", href: "/admin" }, { name: "Stories", href: "/admin/stories" }]} current="Review drafts" />
      <Typography variant="h4" sx={{ mb: 1 }}>Review drafts</Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>
        Read each story and the checks beside it. Approve only a story you have read and are satisfied is accurate: the name you enter is shown as its byline and your login is recorded as the approver.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {approved && <Alert severity="success" sx={{ mb: 2 }}>Published: {approved}</Alert>}
      {reviewable.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>No drafts waiting for review.</Typography>
      ) : (
        <Stack spacing={3}>
          {reviewable.map((d) => {
            const pack = packOf.get(reviewPackKey(d.id))!;
            return (
              <Card key={d.id} variant="outlined" sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", gap: 0.5 }}>
                  <Chip size="small" variant="outlined" label={categoryChipStyle(d.category).label} />
                  <Chip size="small" variant="outlined" label={pack.kind} />
                  <Chip size="small" variant="outlined" label={`${pack.facts.length} researched facts`} />
                  {pack.removed > 0 && <Chip size="small" color="warning" variant="outlined" label={`${pack.removed} claim(s) cut by the fact-check`} />}
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{d.title}</Typography>
                <Typography sx={{ color: "text.secondary", mb: 1.5 }}>{d.summary}</Typography>
                {d.heroImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.heroImageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 6, marginBottom: 8 }} />
                )}
                {d.heroImageCredit && <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1.5 }}>Photo: {d.heroImageCredit}</Typography>}
                {(d.body ?? "").split(/\n\n+/).map((p, i) => (
                  <Typography key={i} sx={{ mb: 1.25 }}>{p}</Typography>
                ))}
                <Card variant="outlined" sx={{ p: 1.5, mt: 2, bgcolor: "action.hover" }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Review pack</Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Sources read: {pack.sources.join(", ") || "none listed"}</Typography>
                  {pack.checks.length > 0 && (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>To check:</Typography>
                      <ul style={{ margin: "2px 0 8px 18px", padding: 0 }}>
                        {pack.checks.map((c, i) => <li key={i}><Typography variant="body2">{c}</Typography></li>)}
                      </ul>
                    </>
                  )}
                  <details>
                    <summary style={{ cursor: "pointer" }}><Typography component="span" variant="body2">Researched facts the story was written from ({pack.facts.length})</Typography></summary>
                    <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                      {pack.facts.map((f, i) => <li key={i}><Typography variant="body2">{f}</Typography></li>)}
                    </ul>
                  </details>
                </Card>
                <form action={approveReviewedDraft} style={{ marginTop: 16 }}>
                  <input type="hidden" name="id" value={d.id} />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
                    <TextField name="byline" size="small" label="Byline name" defaultValue={defaultByline} required sx={{ minWidth: 240 }} />
                    <Button type="submit" variant="contained">Approve &amp; publish</Button>
                  </Stack>
                </form>
              </Card>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
