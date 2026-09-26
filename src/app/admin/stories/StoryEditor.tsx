"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Autocomplete from "@mui/material/Autocomplete";
import { tagGroupLabel, type TagOption } from "@/lib/tagOptions";
import { saveStory, uploadStoryImage, deleteDraft } from "./actions";
import { STORY_KINDS, STORY_LIMITS, wordCount } from "@/lib/stories";

export interface StoryEditorValues {
  id?: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  storyKind: string;
  heroImageUrl: string | null;
  heroImageCredit: string | null;
  authorName: string;
  authorBio: string;
  status?: string;
  slug?: string;
  // false for an ingested story being edited.
  original: boolean;
  hasByline: boolean;
  seriesKey: string | null;
  tags: { kind: string; slug: string }[];
}

export interface SeriesOption {
  key: string;
  label: string;
}

// Photos are resized in the browser before upload (longest side 1600px,
// JPEG): a phone photo is 3-10 MB, the site never shows one wider than
// ~1200px, and a small upload is quick on a mobile connection.
const MAX_SIDE = 1600;
async function resizeForUpload(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), "image/jpeg", 0.85));
}

// The byline is remembered in this browser so it doesn't need retyping.
const BYLINE_KEY = "swl:byline";

export function StoryEditor({ initial, categories, seriesOptions, tagOptions }: {
  initial: StoryEditorValues;
  categories: { value: string; label: string }[];
  seriesOptions: SeriesOption[];
  tagOptions: TagOption[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [byline, setByline] = useState(initial.hasByline);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initial.authorName) return;
    try {
      const saved = JSON.parse(localStorage.getItem(BYLINE_KEY) ?? "null") as { name?: string; bio?: string } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage after hydration
      if (saved?.name) setV((cur) => ({ ...cur, authorName: saved.name ?? "", authorBio: saved.bio ?? "" }));
    } catch {
      // Storage unavailable — type it in.
    }
  }, [initial.authorName]);

  const set = <K extends keyof StoryEditorValues>(key: K, value: StoryEditorValues[K]) => setV((cur) => ({ ...cur, [key]: value }));

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", new File([await resizeForUpload(file)], "photo.jpg", { type: "image/jpeg" }));
      const r = await uploadStoryImage(form);
      if (r.ok) set("heroImageUrl", r.url);
      else setMessage({ kind: "error", text: r.error });
    } catch {
      setMessage({ kind: "error", text: "Couldn't read that photo — try a JPEG or PNG." });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function save(publish: boolean) {
    setMessage(null);
    startTransition(async () => {
      const r = await saveStory({ ...v, publish, byline });
      if (!r.ok) {
        setMessage({ kind: "error", text: r.error });
        return;
      }
      try {
        if (v.authorName.trim()) localStorage.setItem(BYLINE_KEY, JSON.stringify({ name: v.authorName.trim(), bio: v.authorBio.trim() }));
      } catch {
        // Not remembered — fine.
      }
      setV((cur) => ({ ...cur, id: r.id, slug: r.slug, status: r.status }));
      setMessage({ kind: "success", text: r.status === "published" ? "Published." : r.status === "draft" ? "Draft saved." : "Saved." });
      if (!v.id) router.replace(`/admin/stories/${r.id}`);
      router.refresh();
    });
  }

  function remove() {
    if (!v.id || !confirm("Delete this draft? This can't be undone.")) return;
    startTransition(async () => {
      const r = await deleteDraft(v.id!);
      if (r.ok) router.push("/admin/stories");
      else setMessage({ kind: "error", text: r.error });
    });
  }

  const words = wordCount(v.body);
  const live = v.status === "published";

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 820 }}>
      {message && <Alert severity={message.kind}>{message.text}</Alert>}
      {!v.original && (
        <Alert severity="info">
          Editing an ingested story. Changes go live straight away. Tick &quot;Show my byline&quot; only if you&apos;ve substantially rewritten it.
        </Alert>
      )}

      <TextField label="Headline" value={v.title} onChange={(e) => set("title", e.target.value)} fullWidth
        helperText={`${v.title.trim().length}/${STORY_LIMITS.title.max}`} slotProps={{ htmlInput: { maxLength: STORY_LIMITS.title.max } }} />

      <TextField label="Summary" value={v.summary} onChange={(e) => set("summary", e.target.value)} fullWidth multiline minRows={2}
        helperText={`One or two sentences shown under the headline and in search results. ${v.summary.trim().length}/${STORY_LIMITS.summary.max}`}
        slotProps={{ htmlInput: { maxLength: STORY_LIMITS.summary.max } }} />

      {v.original && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField select label="Sport" value={v.category} onChange={(e) => set("category", e.target.value)} sx={{ minWidth: 240 }}>
            {categories.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
          <TextField select label="Kind of piece" value={v.storyKind} onChange={(e) => set("storyKind", e.target.value)} sx={{ minWidth: 200 }}>
            {Object.entries(STORY_KINDS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
        </Stack>
      )}

      <Box>
        <Typography variant="subtitle2" gutterBottom>Photo</Typography>
        {v.heroImageUrl && (
          <Box component="img" src={v.heroImageUrl} alt="" sx={{ display: "block", width: "100%", maxWidth: 480, aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 1, mb: 1 }} />
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Button variant="outlined" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : v.heroImageUrl ? "Replace photo" : "Upload photo"}
          </Button>
          {v.heroImageUrl && <Button color="inherit" onClick={() => set("heroImageUrl", null)}>Remove</Button>}
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        </Stack>
        <TextField label="Photo credit" value={v.heroImageCredit ?? ""} onChange={(e) => set("heroImageCredit", e.target.value)} size="small" sx={{ mt: 1.5, maxWidth: 420 }} fullWidth
          helperText="Who took it — use only photos you took or have permission to use." />
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>Tags</Typography>
        <Stack spacing={2}>
          <TextField select label="Series or event" value={v.seriesKey ?? ""} onChange={(e) => set("seriesKey", e.target.value || null)} sx={{ maxWidth: 480 }}
            helperText="The story is listed on that series page, next to its fixtures and scores.">
            <MenuItem value="">None</MenuItem>
            {seriesOptions.map((o) => <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>)}
          </TextField>
          <Autocomplete
            multiple
            options={tagOptions}
            groupBy={(o) => tagGroupLabel(o.kind)}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.kind === b.kind && a.slug === b.slug}
            value={tagOptions.filter((o) => v.tags.some((t) => t.kind === o.kind && t.slug === o.slug))}
            onChange={(_, chosen) => set("tags", chosen.map((o) => ({ kind: o.kind, slug: o.slug })))}
            renderInput={(params) => (
              <TextField {...params} label="Players, teams and venues" placeholder="Type a name" helperText="The story shows on each one's page." />
            )}
          />
        </Stack>
      </Box>

      <TextField label="Story" value={v.body} onChange={(e) => set("body", e.target.value)} fullWidth multiline minRows={14}
        helperText={`Leave a blank line between paragraphs. Start a line with "## " for a subheading. ${words} words`} />

      <Box>
        <Typography variant="subtitle2" gutterBottom>Byline</Typography>
        {!v.original && (
          <FormControlLabel control={<Checkbox checked={byline} onChange={(e) => setByline(e.target.checked)} />} label="Show my byline (I've substantially rewritten this story)" />
        )}
        {(v.original || byline) && (
          <Stack spacing={1.5}>
            <TextField label="Writer's name" value={v.authorName} onChange={(e) => set("authorName", e.target.value)} size="small" sx={{ maxWidth: 420 }} />
            <TextField label="Short bio (optional)" value={v.authorBio} onChange={(e) => set("authorBio", e.target.value)} size="small" multiline minRows={2}
              helperText="Shown on the writer's page." />
          </Stack>
        )}
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        {v.original ? (
          <>
            <Button variant="contained" onClick={() => save(true)} disabled={pending || uploading}>{live ? "Update" : "Publish"}</Button>
            {!live && <Button variant="outlined" onClick={() => save(false)} disabled={pending || uploading}>Save draft</Button>}
            {v.id && v.status === "draft" && <Button color="error" onClick={remove} disabled={pending}>Delete draft</Button>}
          </>
        ) : (
          <Button variant="contained" onClick={() => save(false)} disabled={pending || uploading}>Save changes</Button>
        )}
        {v.slug && live && (
          <a href={`/article/${v.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>View on site ↗</a>
        )}
      </Stack>
    </Stack>
  );
}
