"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import CloseIcon from "@mui/icons-material/Close";
import { displaySummary } from "@/lib/articleSummary";

export interface QueueArticle {
  id: string;
  title: string;
  summary: string;
  body: string | null;
  category: string;
  sourceName: string;
  sourceUrl: string;
  heroImageUrl: string | null;
  featured: boolean;
  highlighted: boolean;
  readabilityScore: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  poll: { id: string; question: string; options: { id: string; text: string }[] } | null;
}

export function ArticleQueueClient({
  articles,
  status,
  approveArticle,
  rejectArticle,
  featureArticle,
  unfeatureArticle,
  highlightArticle,
  unhighlightArticle,
  approveArticles,
  createPoll,
  deletePoll,
}: {
  articles: QueueArticle[];
  status: "pending_review" | "published";
  approveArticle: (articleId: string) => Promise<void>;
  rejectArticle: (articleId: string, reason?: string) => Promise<void>;
  featureArticle: (articleId: string) => Promise<void>;
  unfeatureArticle: (articleId: string) => Promise<void>;
  highlightArticle: (articleId: string) => Promise<void>;
  unhighlightArticle: (articleId: string) => Promise<void>;
  approveArticles: (articleIds: string[]) => Promise<void>;
  createPoll: (articleId: string, formData: FormData) => Promise<void>;
  deletePoll: (pollId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const detailArticle = articles.find((a) => a.id === detailId) ?? null;

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkApprove() {
    const ids = [...selected];
    startTransition(async () => {
      await approveArticles(ids);
      setSelected(new Set());
    });
  }

  return (
    <>
      {status === "pending_review" && selected.size > 0 && (
        <Box
          sx={{
            position: "sticky",
            top: 8,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            p: 1.5,
            mb: 2,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "primary.main",
            bgcolor: "background.paper",
            boxShadow: 2,
          }}
        >
          <Typography variant="body2">{selected.size} selected</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" color="inherit" onClick={() => setSelected(new Set())} disabled={isPending}>
              Clear
            </Button>
            <Button size="small" variant="contained" color="success" onClick={handleBulkApprove} disabled={isPending}>
              {isPending ? "Approving…" : `Approve ${selected.size}`}
            </Button>
          </Stack>
        </Box>
      )}

      <Stack spacing={2}>
        {articles.map((article) => (
          <Card
            key={article.id}
            variant="outlined"
            sx={article.featured ? { borderColor: "primary.main", borderWidth: 2 } : undefined}
          >
            <CardContent>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                {status === "pending_review" && (
                  <Checkbox
                    checked={selected.has(article.id)}
                    onChange={() => toggleSelected(article.id)}
                    sx={{ mt: -1, ml: -1.5 }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {article.category} · {article.sourceName}
                      {status === "published" && article.reviewedAt && (
                        <> · Approved {article.reviewedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
                      )}
                      {status === "pending_review" && (
                        <> · Submitted {article.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
                      )}
                    </Typography>
                    {article.featured && <Chip label="★ Featured hero" size="small" sx={{ color: "primary" }} />}
                    {article.highlighted && <Chip label="📌 Highlighted" size="small" sx={{ color: "warning" }} />}
                    {article.readabilityScore != null && article.readabilityScore < 40 && (
                      <Chip label="low readability score" size="small" variant="outlined" sx={{ color: "warning" }} />
                    )}
                  </Stack>
                  <Typography
                    variant="h6"
                    component="h2"
                    gutterBottom
                    onClick={() => setDetailId(article.id)}
                    sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                  >
                    {article.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                    {displaySummary(article)}
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                    <Button size="small" onClick={() => setDetailId(article.id)}>View details</Button>
                    <a href={article.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "inherit" }}>
                      Source ↗
                    </a>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2, flexWrap: "wrap" }}>
              {status === "pending_review" && (
                <>
                  <form action={approveArticle.bind(null, article.id)}>
                    <Button type="submit" variant="contained" color="success">Approve</Button>
                  </form>
                  <form action={rejectArticle.bind(null, article.id, undefined)}>
                    <Button type="submit" variant="outlined" color="inherit">Reject</Button>
                  </form>
                </>
              )}
              {/* Feature/Highlight work even on a still-pending article —
                  the pick is stored immediately and takes effect on the
                  homepage as soon as it's approved, so an admin can decide
                  "this should be hero" while reviewing instead of having to
                  come back after approving. */}
              {article.featured ? (
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

      <Dialog open={detailArticle !== null} onClose={() => setDetailId(null)} maxWidth="sm" fullWidth>
        {detailArticle && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              {detailArticle.title}
              <IconButton onClick={() => setDetailId(null)} sx={{ position: "absolute", right: 8, top: 8 }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {detailArticle.heroImageUrl && (
                <Box
                  component="img"
                  src={detailArticle.heroImageUrl}
                  alt=""
                  sx={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 1, mb: 2 }}
                />
              )}
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
                {detailArticle.category} · {detailArticle.sourceName}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                {detailArticle.body || detailArticle.summary}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <a href={detailArticle.sourceUrl} target="_blank" rel="noreferrer">
                  View original source ↗
                </a>
              </Box>

              {/* Only on published articles — a poll only makes sense once
                  readers can actually see and vote on it. Hand-curated only,
                  deliberately not auto-generated (see actions.ts's createPoll
                  comment) — a predictive question is an editorial call, not
                  a pipeline step. */}
              {status === "published" && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Reader poll</Typography>
                  {detailArticle.poll ? (
                    <>
                      <Typography variant="body2" sx={{ mb: 1 }}>{detailArticle.poll.question}</Typography>
                      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                        {detailArticle.poll.options.map((o) => (
                          <Typography key={o.id} variant="body2" sx={{ color: "text.secondary" }}>• {o.text}</Typography>
                        ))}
                      </Stack>
                      <form action={deletePoll.bind(null, detailArticle.poll.id)}>
                        <Button type="submit" size="small" variant="outlined" color="inherit">Delete poll</Button>
                      </form>
                    </>
                  ) : (
                    <form action={createPoll.bind(null, detailArticle.id)}>
                      <Stack spacing={1.5}>
                        <TextField name="question" label="Poll question" size="small" required fullWidth />
                        <TextField name="option" label="Option 1" size="small" required fullWidth />
                        <TextField name="option" label="Option 2" size="small" required fullWidth />
                        <TextField name="option" label="Option 3 (optional)" size="small" fullWidth />
                        <TextField name="option" label="Option 4 (optional)" size="small" fullWidth />
                        <Button type="submit" size="small" variant="contained">Create poll</Button>
                      </Stack>
                    </form>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ flexWrap: "wrap" }}>
              <Button onClick={() => setDetailId(null)} color="inherit">Close</Button>
              {detailArticle.highlighted ? (
                <form action={unhighlightArticle.bind(null, detailArticle.id)}>
                  <Button type="submit" variant="outlined" color="warning">Remove highlight</Button>
                </form>
              ) : (
                <form action={highlightArticle.bind(null, detailArticle.id)}>
                  <Button type="submit" variant="outlined" color="warning">Highlight</Button>
                </form>
              )}
              {detailArticle.featured ? (
                <form action={unfeatureArticle.bind(null, detailArticle.id)}>
                  <Button type="submit" variant="outlined" color="inherit">Remove as hero</Button>
                </form>
              ) : (
                <form action={featureArticle.bind(null, detailArticle.id)}>
                  <Button type="submit" variant="outlined">Feature as hero</Button>
                </form>
              )}
              {status === "pending_review" && (
                <>
                  <form action={rejectArticle.bind(null, detailArticle.id, undefined)}>
                    <Button type="submit" variant="outlined" color="inherit" onClick={() => setDetailId(null)}>
                      Reject
                    </Button>
                  </form>
                  <form action={approveArticle.bind(null, detailArticle.id)}>
                    <Button type="submit" variant="contained" color="success" onClick={() => setDetailId(null)}>
                      Approve
                    </Button>
                  </form>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
