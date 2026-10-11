"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// Private feedback form: thumbs up or down plus an optional short note. Notes
// are read by our team only and never shown to other visitors.
export function SiteFeedbackForm() {
  const [sentiment, setSentiment] = useState<"up" | "down" | null>(null);
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, hidden from people
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sentiment || busy) return;
    setBusy(true);
    setError(null);
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      const page = referrer && referrer.origin === location.origin ? referrer.pathname : null;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentiment, note, page, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDone(true);
      else setError(data.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <Typography>Thank you! Your feedback goes straight to our team.</Typography>;
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} role="radiogroup" aria-label="How are we doing?">
          {([["up", "👍 Liking it"], ["down", "👎 Needs work"]] as const).map(([value, label]) => (
            <Button
              key={value}
              role="radio"
              aria-checked={sentiment === value}
              variant={sentiment === value ? "contained" : "outlined"}
              onClick={() => setSentiment(value)}
              sx={{ textTransform: "none" }}
            >
              {label}
            </Button>
          ))}
        </Stack>
        <TextField
          label="Anything we should know? (optional)"
          multiline
          minRows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 300 } }}
          helperText={`${note.length}/300. Please don't include links or personal details.`}
        />
        <Box aria-hidden sx={{ position: "absolute", left: -9999, height: 0, overflow: "hidden" }}>
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </Box>
        {error && <Typography variant="body2" sx={{ color: "error.main" }}>{error}</Typography>}
        <Box>
          <Button type="submit" variant="contained" disabled={!sentiment || busy}>Send feedback</Button>
        </Box>
      </Stack>
    </Box>
  );
}
