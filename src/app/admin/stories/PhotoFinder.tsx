"use client";

import { useState, useTransition, type FormEvent } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { PhotoResult } from "@/lib/photoSearch";
import { importStoryPhoto, searchStoryPhotos } from "./actions";

export interface PickedPhoto {
  url: string;
  credit: string;
  creditUrl: string;
}

// "Find a photo" for the story editor: searches free, commercially usable
// photos (Wikimedia Commons + Openverse — lib/photoSearch.ts), shows each
// one's photographer and licence, and copies the chosen one into our own
// storage with its credit filled in.
export function PhotoFinder({ open, initialQuery, onClose, onPick }: {
  open: boolean;
  initialQuery: string;
  onClose: () => void;
  onPick: (photo: PickedPhoto) => void;
}) {
  const phone = useMediaQuery("(max-width:600px)");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PhotoResult[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PhotoResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [importing, startImport] = useTransition();

  function search(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setSelected(null);
    startSearch(async () => {
      const r = await searchStoryPhotos(query);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResults(r.results);
      setFailed(r.failed);
    });
  }

  function use(photo: PhotoResult) {
    setError(null);
    startImport(async () => {
      const r = await importStoryPhoto(photo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onPick({ url: r.url, credit: r.credit, creditUrl: r.creditUrl });
      onClose();
    });
  }

  return (
    <Dialog open={open} onClose={importing ? undefined : onClose} fullScreen={phone} fullWidth maxWidth="lg" slotProps={{ paper: { sx: { height: phone ? "100%" : "88vh" } } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}>
        <Box sx={{ flex: 1 }}>
          Find a photo
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Free photos licensed for commercial use, from Wikimedia Commons and Openverse. The credit is added for you.
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} disabled={importing}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, p: { xs: 1.5, sm: 2.5 } }}>
        <Box component="form" onSubmit={search} sx={{ display: "flex", gap: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="e.g. Greenfield stadium, Virat Kohli, NFL crowd"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <Button type="submit" variant="contained" disabled={searching || query.trim().length < 2}>
            {searching ? <CircularProgress size={20} color="inherit" /> : "Search"}
          </Button>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {failed.length > 0 && <Alert severity="warning">{failed.join(" and ")} didn&apos;t answer — showing the rest.</Alert>}

        <Box sx={{ display: "flex", gap: 2, flex: 1, minHeight: 0, flexDirection: { xs: "column", md: "row" } }}>
          {/* Results */}
          <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {results === null ? (
              <EmptyHint text="Search for a player, team, ground or scene. Tip: specific names (a stadium, a player) find real photos; general words (crowd, pitch) find scene shots." />
            ) : results.length === 0 ? (
              <EmptyHint text="No free photos found — try fewer or different words." />
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.25 }}>
                {results.map((r) => {
                  const active = selected?.id === r.id;
                  return (
                    <Box
                      key={r.id}
                      component="button"
                      type="button"
                      onClick={() => setSelected(r)}
                      aria-pressed={active}
                      sx={{
                        p: 0, border: "2px solid", borderColor: active ? "primary.main" : "transparent", borderRadius: 1.5,
                        overflow: "hidden", cursor: "pointer", bgcolor: "action.hover", textAlign: "left", position: "relative", font: "inherit",
                        "&:hover img": { opacity: 0.9 },
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote previews in an admin tool, not site images */}
                      <img src={r.thumbUrl} alt={r.title} loading="lazy" style={{ display: "block", width: "100%", aspectRatio: "3 / 2", objectFit: "cover" }} />
                      {active && <CheckCircleIcon sx={{ position: "absolute", top: 6, right: 6, color: "primary.main", bgcolor: "#fff", borderRadius: "50%" }} />}
                      <Box sx={{ px: 1, py: 0.75 }}>
                        <Typography variant="caption" noWrap sx={{ display: "block", fontWeight: 600 }}>{r.creator}</Typography>
                        <Typography variant="caption" noWrap sx={{ display: "block", color: "text.secondary" }}>
                          {r.license} · {r.width >= r.height ? "Landscape" : "Portrait"}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          {/* Selected photo */}
          {selected && (
            <Box sx={{ width: { xs: "100%", md: 340 }, flexShrink: 0, border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, display: "flex", flexDirection: "column", gap: 1.5, alignSelf: "flex-start" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote preview */}
              <img src={selected.thumbUrl} alt={selected.title} style={{ width: "100%", borderRadius: 8, aspectRatio: "16 / 9", objectFit: "cover", background: "#eee" }} />
              <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>{selected.title}</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                <Chip size="small" label={selected.license} color="success" variant="outlined" />
                <Chip size="small" label={selected.sourceName} variant="outlined" />
                <Chip size="small" label={`${selected.width}×${selected.height}`} variant="outlined" />
              </Stack>
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Credit shown under the photo</Typography>
                <Typography variant="body2">{selected.credit}</Typography>
              </Box>
              <Typography variant="body2" component="a" href={selected.landingUrl} target="_blank" rel="noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "primary.main" }}>
                Check the photo&apos;s page and licence <OpenInNewIcon sx={{ fontSize: 15 }} />
              </Typography>
              <Button variant="contained" onClick={() => use(selected)} disabled={importing}>
                {importing ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> Adding…</> : "Use this photo"}
              </Button>
            </Box>
          )}
        </Box>

        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Only photos licensed for commercial use (CC BY, CC BY-SA, CC0, public domain) are shown; the photographer&apos;s credit and a link to the
          licence stay with the photo. Photos of people are for news and analysis — not for adverts or to suggest someone endorses us.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Box sx={{ height: "100%", minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "text.secondary", px: 2 }}>
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}
