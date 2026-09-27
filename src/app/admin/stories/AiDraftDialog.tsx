"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import type { AiDraft } from "@/lib/aiDraft";
import { draftStoryWithAI, type AiDraftRequest } from "./actions";

// Optional first draft for the writer (lib/aiDraft.ts). Uses the story's
// sport, kind, series and tags as they're set in the editor, plus a brief.
export function AiDraftDialog({ open, onClose, request, contextLabels, onUse, initialBrief = "" }: {
  open: boolean;
  onClose: () => void;
  request: Omit<AiDraftRequest, "brief">;
  contextLabels: string[];
  onUse: (draft: AiDraft) => void;
  // From a story idea — editable like any brief.
  initialBrief?: string;
}) {
  const phone = useMediaQuery("(max-width:600px)");
  const [brief, setBrief] = useState(initialBrief);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function generate() {
    setError(null);
    start(async () => {
      const r = await draftStoryWithAI({ ...request, brief });
      if (r.ok) setDraft(r.draft);
      else setError(r.error);
    });
  }

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullScreen={phone} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
        <Box sx={{ flex: 1 }}>
          Draft with AI <Chip label="Optional" size="small" sx={{ ml: 1 }} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            A first draft from the site&apos;s own data, for you to rewrite and check. Nothing is published until you do.
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} disabled={pending}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="What's the story?"
            placeholder="e.g. Preview of the 2nd ODI in Guwahati — can West Indies' spinners trouble India's middle order after the Greenfield loss?"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 600 } }}
          />
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>Background it will use (set in the editor)</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
              {contextLabels.map((l) => <Chip key={l} label={l} size="small" variant="outlined" />)}
            </Stack>
            {!request.seriesKey && request.tags.length === 0 && (
              <Typography variant="caption" sx={{ color: "warning.main", display: "block", mt: 0.5 }}>
                Tip: pick a series and tag the players, teams or ground first — the draft is only as good as the facts it gets.
              </Typography>
            )}
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {pending && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", color: "text.secondary" }}>
              <CircularProgress size={20} /> <Typography variant="body2">Writing a draft… (10–20 seconds)</Typography>
            </Stack>
          )}
          {draft && !pending && (
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "1.15rem", lineHeight: 1.3 }}>{draft.title}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, mb: 1.5 }}>{draft.summary}</Typography>
              <Box sx={{ maxHeight: 320, overflowY: "auto", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, pr: 1 }}>{draft.body}</Box>
              {draft.checks.length > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <strong>Check before publishing:</strong> {draft.checks.join(" · ")}
                </Alert>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={pending}>Cancel</Button>
        <Button onClick={generate} variant={draft ? "outlined" : "contained"} disabled={pending || brief.trim().length < 10}>
          {draft ? "Try again" : "Write draft"}
        </Button>
        {draft && (
          <Button variant="contained" disabled={pending} onClick={() => { onUse(draft); onClose(); }}>
            Use this draft
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
