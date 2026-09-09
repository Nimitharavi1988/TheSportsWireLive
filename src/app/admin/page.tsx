import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  approveArticle,
  rejectArticle,
  featureArticle,
  unfeatureArticle,
  highlightArticle,
  unhighlightArticle,
  unflagArticle,
} from "./actions";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";

export default async function AdminQueuePage(
  props: {
    searchParams: Promise<{ q?: string; source?: string; category?: string; status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { q, source, category } = searchParams;
  const status = searchParams.status === "published" ? "published" : "pending_review";

  const sources = await db.article.findMany({
    where: { status },
    select: { sourceName: true },
    distinct: ["sourceName"],
  });
  const categories = await db.article.findMany({
    where: { status },
    select: { category: true },
    distinct: ["category"],
  });

  const where = {
    status: status as "pending_review" | "published",
    ...(source ? { sourceName: source } : {}),
    ...(category ? { category } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const totalForStatus = await db.article.count({ where: { status } });
  const matchingCount = await db.article.count({ where });

  const list = await db.article.findMany({
    where,
    orderBy: status === "published" ? [{ featured: "desc" }, { publishedAt: "desc" }] : { createdAt: "desc" },
    take: 50,
  });

  const flagged =
    status === "pending_review"
      ? await db.article.findMany({
          where: { status: "flagged" },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : [];

  const hasFilters = Boolean(q || source || category);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {status === "published" ? "Published articles" : "Review queue"} (
        {hasFilters ? `${matchingCount} matching, ${totalForStatus} total` : `${totalForStatus} ${status === "published" ? "published" : "pending"}`}
        )
      </Typography>

      <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Box
          component="form"
          method="GET"
          sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}
        >
          <TextField size="small" select name="status" label="Status" defaultValue={status} sx={{ minWidth: 160 }}>
            <MenuItem value="pending_review">Pending review</MenuItem>
            <MenuItem value="published">Published</MenuItem>
          </TextField>
          <TextField
            size="small"
            name="q"
            label="Search titles"
            defaultValue={q ?? ""}
            sx={{ flex: "1 1 220px" }}
          />
          <TextField size="small" select name="source" label="Source" defaultValue={source ?? ""} sx={{ minWidth: 180 }}>
            <MenuItem value="">All sources</MenuItem>
            {sources.map((s) => (
              <MenuItem key={s.sourceName} value={s.sourceName}>{s.sourceName}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" select name="category" label="Category" defaultValue={category ?? ""} sx={{ minWidth: 180 }}>
            <MenuItem value="">All categories</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.category} value={c.category}>{c.category}</MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained">Filter</Button>
          {hasFilters && (
            <Button href={`/admin?status=${status}`} color="inherit">Clear</Button>
          )}
        </Box>
      </Card>

      {list.length === 0 && (
        <Typography
          align="center"
          sx={{
            color: "text.secondary",
            py: 4
          }}>
          Nothing matches right now.
        </Typography>
      )}

      {matchingCount > list.length && (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>
          Showing first {list.length} of {matchingCount} matching articles — narrow your search to see more precisely.
        </Typography>
      )}

      <Stack spacing={2}>
        {list.map((article) => (
          <Card key={article.id} variant="outlined" sx={article.featured ? { borderColor: "primary.main", borderWidth: 2 } : undefined}>
            <CardContent>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  mb: 1
                }}>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>
                  {article.category} · {article.sourceName}
                  {status === "published" && article.reviewedAt && (
                    <> · Approved {article.reviewedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
                  )}
                  {status === "pending_review" && (
                    <> · Submitted {article.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
                  )}
                </Typography>
                {article.featured && <Chip label="★ Featured hero" size="small" sx={{
                  color: "primary"
                }} />}
                {article.highlighted && <Chip label="📌 Highlighted" size="small" sx={{
                  color: "warning"
                }} />}
                {article.readabilityScore != null && article.readabilityScore < 40 && (
                  <Chip label="low readability score" size="small" variant="outlined" sx={{
                    color: "warning"
                  }} />
                )}
              </Stack>
              <Typography variant="h6" component="h2" gutterBottom>
                {article.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mb: 1
                }}>
                {article.summary}
              </Typography>
              <a href={article.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "inherit" }}>
                Source ↗
              </a>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2, flexWrap: "wrap" }}>
              {status === "pending_review" ? (
                <>
                  <form action={approveArticle.bind(null, article.id)}>
                    <Button type="submit" variant="contained" color="success">Approve</Button>
                  </form>
                  <form action={rejectArticle.bind(null, article.id, undefined)}>
                    <Button type="submit" variant="outlined" color="inherit">Reject</Button>
                  </form>
                </>
              ) : article.featured ? (
                <form action={unfeatureArticle.bind(null, article.id)}>
                  <Button type="submit" variant="outlined" color="inherit">Remove as hero</Button>
                </form>
              ) : (
                <form action={featureArticle.bind(null, article.id)}>
                  <Button type="submit" variant="contained">Feature as hero</Button>
                </form>
              )}
              {article.highlighted ? (
                <form action={unhighlightArticle.bind(null, article.id)}>
                  <Button type="submit" variant="outlined" color="warning">Remove highlight</Button>
                </form>
              ) : (
                <form action={highlightArticle.bind(null, article.id)}>
                  <Button type="submit" variant="outlined" color="warning">Highlight (transfers/big news)</Button>
                </form>
              )}
            </CardActions>
          </Card>
        ))}
      </Stack>

      {flagged.length > 0 && (
        <Box sx={{ mt: 5 }}>
          <Typography variant="h6">Flagged by automated checks</Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 1.5
            }}>
            These failed the profanity or readability check and never reached the
            queue above. Shown here so you can spot patterns and tune the filters.
          </Typography>
          <Stack>
            {flagged.map((article, index) => (
              <Box key={article.id}>
                {index > 0 && <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}
                <Box sx={{ py: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="body2">
                    {article.title} — {article.profanityDetail ?? "readability"}
                  </Typography>
                  <form action={unflagArticle.bind(null, article.id)}>
                    <Button type="submit" size="small" variant="text">False positive? Send to review</Button>
                  </form>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Container>
  );
}
