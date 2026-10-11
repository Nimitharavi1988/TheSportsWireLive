"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface Voice {
  id: string;
  name: string;
  country: string | null;
  body: string;
}

interface VoicesState {
  open: boolean;
  voices: Voice[];
  mine: string | null; // this visitor's own take: pending | approved | rejected
}

// "Fans say": approved takes on a big match, plus a short form to add one.
// Every take is reviewed by a person before it appears. Renders nothing for
// matches that don't offer takes and nothing until the page has loaded them.
export function FanVoices({ articleId }: { articleId: string }) {
  const [state, setState] = useState<VoicesState | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, hidden from people
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fan-voices/${articleId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/fan-voices/${articleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, country, body, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
        setEditing(false);
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!state || !state.open) return null;
  const hasVoices = state.voices.length > 0;
  const alreadySent = sent || state.mine !== null;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>Fans say</Typography>

      {hasVoices && (
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {state.voices.map((v) => (
            <Box key={v.id}>
              <Typography variant="body2">&ldquo;{v.body}&rdquo;</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {v.name}{v.country ? `, ${v.country}` : ""}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {alreadySent ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {state.mine === "approved"
            ? "Thanks, your take is published above."
            : state.mine === "rejected"
              ? "Thanks for sharing. We could not publish your take this time."
              : "Thanks! Your take will appear here once our team has read it."}
        </Typography>
      ) : editing ? (
        <Box component="form" onSubmit={submit}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField size="small" label="First name" required value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 30 } }} fullWidth />
              <TextField size="small" label="Country (optional)" value={country} onChange={(e) => setCountry(e.target.value)} slotProps={{ htmlInput: { maxLength: 30 } }} fullWidth />
            </Stack>
            <TextField
              size="small"
              label="Your take on the match (8 to 150 words)"
              required
              multiline
              minRows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 900 } }}
            />
            {/* Honeypot: real visitors never see or fill this. */}
            <Box aria-hidden sx={{ position: "absolute", left: -9999, height: 0, overflow: "hidden" }}>
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              No links or contact details, please. Your first name and country are shown if we publish your take.
            </Typography>
            {error && <Typography variant="body2" sx={{ color: "error.main" }}>{error}</Typography>}
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" size="small" disabled={busy}>Send my take</Button>
              <Button size="small" color="inherit" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <Button variant="outlined" size="small" onClick={() => setEditing(true)} sx={{ textTransform: "none" }}>
          {hasVoices ? "Add your take" : "Be the first to share your take"}
        </Button>
      )}
    </Paper>
  );
}
