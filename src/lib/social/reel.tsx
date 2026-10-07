import { ImageResponse } from "next/og";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReactElement } from "react";
import type { PosterContent } from "@/lib/ingestion/commentary";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { loadHeroImageDataUri, BRAND_GREEN } from "./instagramPoster";
import { generateReelMusic, type ReelMusicStyle } from "./reelMusic";
import { REEL_THEMES, DEFAULT_REEL_THEME, REEL_FONTS, DEFAULT_REEL_FONT, type ReelTheme, type ReelFont } from "./reelThemes";

const execFileAsync = promisify(execFile);

const W = 1080;
const H = 1920;
const FPS = 30;

// The photo sits uncropped at full width from here down (a 16:9 news photo
// ends around y=910), over a blurred, darkened copy of itself filling the
// frame. Taller photos are cut off at PHOTO_MAX_H from the top. Cropping a
// landscape photo to fill 9:16 instead showed only a thin, upscaled strip
// of it (a face cut off at the edge, visibly soft).
const PHOTO_TOP = 300;
const PHOTO_MAX_H = 1000;
// A sharp, wide photo is instead cropped (subject-aware, sharp's attention
// strategy) to a 4:5 portrait, 1080x1350, and shown big behind the text: 70%
// of the frame rather than 32%. Needs a source at least this tall so it isn't
// blown up; smaller photos keep the layout above.
const USE_PORTRAIT_CROP = false;
const PORTRAIT_ASPECT =1080 / 1350;
const PORTRAIT_PHOTO_TOP = 170;
const PORTRAIT_PHOTO_H = 1350;
const MIN_CROP_SOURCE_H = 800;
// The photo layer is built at SS x size and scaled down at the end, so the
// moving picture stays sharp.
const SS = 2;
// The whole photo layer moves once over the whole reel, eased in and out:
// zooms 1.00 -> 1.00+ZOOM while drifting sideways across PAN_X of the room
// the zoom frees up (left to right) and up by PAN_Y of it.
const ZOOM = 0.18;
const PAN_X = 0.6;
const PAN_Y = 0.3;

// Text scenes hand over back to back: the outgoing card fades out quickly
// (TRANS_OUT, drifting up DRIFT px) and the next fades in (TRANS_IN, sliding
// up SLIDE px into place) OVERLAP seconds before it is gone, all eased, so
// there is no blank beat. The overlap is kept tiny on purpose: two cards
// share one spot, and a longer crossfade shows both as garbled ghost text.
const TRANS_IN = 0.3;
const TRANS_OUT = 0.22;
const OVERLAP = 0.05;
const SLIDE = 50;
const DRIFT = 30;
// Kept quick (~12s, was ~14s): short reels get watched through and replayed.
const HOOK_SECONDS = 3;
const FACT_SECONDS = 2.3;
const END_SECONDS = 1.9;
// Thin bar along the top edge filling up over the reel, so viewers can see
// it's short and stay to the end.
const PROGRESS_H = 10;

function hookSize(hook: string): number {
  if (hook.length <= 38) return 92;
  if (hook.length <= 60) return 80;
  return 68;
}

// Resolved colours and headline font for one reel (reelThemes.ts).
interface Theme {
  accent: string;
  glow: string;
  // The theme's dark shade at the given opacity.
  shade: (alpha: number) => string;
  // Style for big headline text at a given base (Poppins-equivalent) size.
  head: (size: number) => React.CSSProperties;
}

function resolveTheme(name: ReelTheme, fontName: ReelFont): Theme {
  const t = REEL_THEMES[name];
  const font = REEL_FONTS[fontName];
  return {
    accent: t.accent,
    glow: t.glow,
    shade: (a) => `rgba(${t.tint.join(",")},${a})`,
    head: (size) => ({
      fontFamily: font.family,
      fontWeight: font.weight,
      fontSize: Math.round(size * font.scale),
      letterSpacing: font.letterSpacing,
      textTransform: font.uppercase ? "uppercase" : "none",
    }),
  };
}

// Always brand green, whatever the theme.
function Wordmark({ th, size = 34 }: { th: Theme; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: size, fontWeight: 700, color: "white", padding: "10px 22px 10px 16px", borderRadius: 12, background: th.shade(0.78) }}>
      <div style={{ display: "flex", width: size * 0.25, height: size * 1.1, background: BRAND_GREEN, borderRadius: 3, marginRight: 14 }} />
      <div style={{ display: "flex" }}>Sports Wire</div>
      <div style={{ display: "flex", color: BRAND_GREEN, marginLeft: 10 }}>Live</div>
    </div>
  );
}

// Transparent full-frame layer; everything else is positioned inside it.
function Layer({ children }: { children?: React.ReactNode }) {
  return <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", fontFamily: "Poppins" }}>{children}</div>;
}

// Always on top of the photo: shading for legibility, the wordmark and the
// photo credit. The top ~220px stays clear of Instagram's reel header and
// the bottom ~380px of its caption and buttons, so text sits between.
// portrait: the big cropped photo fills the frame under the chrome, so the
// credit goes under the wordmark on the left (the top right often carries the
// publisher's own logo) and the darkening reaches full strength by darkEnd,
// hiding the photo's bottom edge.
function ChromeLayer({ th, credit, darkFrom, darkTo, darkEnd, portrait }: { th: Theme; credit?: string | null; darkFrom: number; darkTo: number; darkEnd: number; portrait: boolean }) {
  return (
    <Layer>
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", background: `linear-gradient(180deg, ${th.shade(0.55)} 0%, ${th.shade(0)} 14%, ${th.shade(0)} ${darkFrom}%, ${th.shade(0.8)} ${darkTo}%, ${th.shade(0.93)} ${darkEnd}%, ${th.shade(0.93)} 100%)` }} />
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", justifyContent: "space-between", alignItems: portrait ? "flex-start" : "center", padding: "185px 60px 0 60px", position: "relative" }}>
        <Wordmark th={th} />
        {credit && <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.85)", maxWidth: 420, textAlign: portrait ? "left" : "right", marginTop: portrait ? 14 : 0, textShadow: "0 1px 6px rgba(0,0,0,0.85)" }}>{credit}</div>}
      </div>
    </Layer>
  );
}

function HookText({ th, content, sportLabel }: { th: Theme; content: PosterContent; sportLabel: string | null }) {
  return (
    <Layer>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", padding: "0 60px 420px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          {sportLabel && (
            <div style={{ display: "flex", padding: "8px 18px", borderRadius: 8, background: th.accent, color: "white", fontSize: 30, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginRight: 18 }}>
              {sportLabel}
            </div>
          )}
          <div style={{ display: "flex", color: "rgba(255,255,255,0.9)", fontSize: 30, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{content.eyebrow}</div>
        </div>
        <div style={{ display: "flex", color: "white", lineHeight: 1.1, ...th.head(hookSize(content.hook)) }}>{content.hook}</div>
        <div style={{ display: "flex", width: 140, height: 10, borderRadius: 5, background: th.accent, marginTop: 32 }} />
      </div>
    </Layer>
  );
}

function FactText({ th, row, index, total }: { th: Theme; row: { label: string; value: string }; index: number; total: number }) {
  const valueSize = row.value.length <= 14 ? 110 : row.value.length <= 30 ? 84 : 62;
  return (
    <Layer>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", margin: "0 60px 440px 60px", padding: "40px 48px 48px 48px", borderRadius: 24, background: th.shade(0.85), borderLeft: `12px solid ${th.accent}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", color: th.accent, fontSize: 34, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{row.label}</div>
          <div style={{ display: "flex", color: "rgba(255,255,255,0.55)", fontSize: 28, fontWeight: 700 }}>
            {index + 1}/{total}
          </div>
        </div>
        <div style={{ display: "flex", color: "white", lineHeight: 1.1, ...th.head(valueSize) }}>{row.value}</div>
      </div>
    </Layer>
  );
}

// Opaque branded end card, fading in over everything.
function EndCard({ th, es }: { th: Theme; es?: boolean }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Poppins", background: `radial-gradient(circle at 50% 40%, ${th.shade(0.78)} 0%, ${th.shade(0.92)} 70%)` }}>
      <Wordmark th={th} size={60} />
      <div style={{ display: "flex", width: 160, height: 10, borderRadius: 5, background: th.accent, margin: "56px 0" }} />
      {/* Asking for comments: they're what gets a reel shown to more people. */}
      <div style={{ display: "flex", color: "white", ...th.head(76) }}>{es ? "¿Qué opinas?" : "What's your take?"}</div>
      <div style={{ display: "flex", color: "rgba(255,255,255,0.85)", fontSize: 44, fontWeight: 600, marginTop: 14 }}>{es ? "Cuéntanoslo en los comentarios" : "Tell us in the comments"}</div>
      <div style={{ display: "flex", color: th.accent, fontSize: 42, fontWeight: 700, marginTop: 80 }}>{es ? "Nota completa: enlace en la bio" : "Full story: link in bio"}</div>
      <div style={{ display: "flex", color: "rgba(255,255,255,0.7)", fontSize: 34, fontWeight: 600, marginTop: 18 }}>Follow @sportswirelivenews</div>
    </div>
  );
}

// Whether a photo of this size gets the big-photo layout (else the older one
// with the photo in the top half).
function fitsPortraitLayout(w: number, h: number): boolean {
  // Off: the 4:5 crop cut subjects off at the edges (raised arms, second
  // player), so every photo now shows whole in the full-width layout.
  if (!USE_PORTRAIT_CROP) return false;
  return h >= MIN_CROP_SOURCE_H && w / h >= 1.3;
}

// Whether a story's photo will get the big-photo layout — checked before
// picking it for a reel (topicReels.ts). False when it can't be loaded.
export async function photoGetsBigLayout(heroImageUrl: string): Promise<boolean> {
  try {
    const uri = await loadHeroImageDataUri(heroImageUrl);
    const sharp = (await import("sharp")).default;
    const meta = await sharp(Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64")).metadata();
    return fitsPortraitLayout(meta.width ?? 0, meta.height ?? 0);
  } catch {
    return false;
  }
}

// Subject-aware crop for a wide, sharp photo (see PORTRAIT_*); null keeps the
// original landscape layout (small photo, no sharp available, or crop failed).
async function cropForPortrait(photo: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(photo).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!fitsPortraitLayout(w, h)) return null;
    const cropW = Math.min(w, Math.round(h * PORTRAIT_ASPECT));
    return await sharp(photo).resize(cropW, h, { fit: "cover", position: sharp.strategy.attention }).jpeg({ quality: 92 }).toBuffer();
  } catch {
    return null;
  }
}

type LayerFonts = { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" }[];

async function renderLayer(node: ReactElement, fonts: LayerFonts): Promise<Buffer> {
  const image = new ImageResponse(node, { width: W, height: H, fonts });
  return Buffer.from(await image.arrayBuffer());
}

// Renders a ~14s vertical reel (1080x1920 H.264 MP4 with AAC music) from
// the same PosterContent the Instagram poster uses: the hook, each key fact
// in turn, then a branded end card. Satori renders the text as transparent
// layers; ffmpeg composites them over the photo, which
// zooms slowly and continuously underneath. Plain Node only (GitHub
// Actions or a local script) — same Satori/Workers restriction as
// instagramPoster.tsx, and ffmpeg-static is a devDependency.
export async function renderReel(params: {
  content: PosterContent;
  heroImageUrl: string;
  category?: string;
  credit?: string | null;
  // One of our own generated tracks (reelMusic.ts), chosen in admin or
  // picked per story (musicStyleFor); defaults to "drive".
  musicStyle?: ReelMusicStyle;
  // Or a music file we hold the rights to, used instead. Trimmed to length
  // and faded out.
  musicPath?: string;
  // Colour theme and headline font (reelThemes.ts); default brand green
  // and Poppins.
  theme?: ReelTheme;
  font?: ReelFont;
  // Also keep the layer PNGs here (for previewing); otherwise a temp dir.
  keepScenesDir?: string;
  // Spanish end card (2026-10-07).
  locale?: "es";
}): Promise<Buffer> {
  const ffmpegPath = (await import("ffmpeg-static")).default as unknown as string | null;
  if (!ffmpegPath) throw new Error("ffmpeg-static has no binary for this platform");

  const fontsDir = join(process.cwd(), "src/assets/fonts");
  const headFont = REEL_FONTS[params.font ?? DEFAULT_REEL_FONT];
  const [bold, semibold, head] = await Promise.all([
    readFile(join(fontsDir, "Poppins-Bold.ttf")),
    readFile(join(fontsDir, "Poppins-SemiBold.ttf")),
    headFont.file ? readFile(join(fontsDir, headFont.file)) : null,
  ]);
  const fonts: LayerFonts = [
    { name: "Poppins", data: bold, weight: 700, style: "normal" },
    { name: "Poppins", data: semibold, weight: 600, style: "normal" },
    ...(head ? [{ name: headFont.family, data: head, weight: headFont.weight, style: "normal" as const }] : []),
  ];
  const photoDataUri = await loadHeroImageDataUri(params.heroImageUrl);
  const original = Buffer.from(photoDataUri.slice(photoDataUri.indexOf(",") + 1), "base64");
  const cropped = await cropForPortrait(original);
  const photo = cropped ?? original;
  const photoTop = cropped ? PORTRAIT_PHOTO_TOP : PHOTO_TOP;
  const photoMaxH = cropped ? PORTRAIT_PHOTO_H : PHOTO_MAX_H;
  // Text darkening starts where the photo's lower part ends.
  const darkFrom = cropped ? 52 : 46;
  const darkTo = cropped ? 68 : 62;
  const darkEnd = cropped ? 82 : 100;
  const sport = params.category ? categoryChipStyle(params.category.split("/")[0]) : null;
  const facts = params.content.rows.slice(0, 3);
  const th = resolveTheme(params.theme ?? DEFAULT_REEL_THEME, params.font ?? DEFAULT_REEL_FONT);

  // Text scenes back to back; the end card starts where the last fact ends.
  const texts: { node: ReactElement; seconds: number }[] = [
    { node: <HookText th={th} content={params.content} sportLabel={sport?.label ?? null} />, seconds: HOOK_SECONDS },
    ...facts.map((row, i) => ({ node: <FactText th={th} row={row} index={i} total={facts.length} />, seconds: FACT_SECONDS })),
  ];
  const starts: number[] = [];
  let t = 0;
  for (const s of texts) {
    starts.push(t);
    t += s.seconds;
  }
  const endStart = t;
  const total = endStart + END_SECONDS;
  const frames = Math.round(total * FPS);

  const workDir = params.keepScenesDir ?? (await mkdtemp(join(tmpdir(), "reel-")));
  try {
    const photoPath = join(workDir, "photo");
    const musicPath = params.musicPath ?? join(workDir, "music.wav");
    if (!params.musicPath) await writeFile(musicPath, generateReelMusic(total, params.musicStyle, { swooshAt: [...starts.slice(1), endStart].map((s) => Math.max(0, s - OVERLAP)) }));
    const chromePath = join(workDir, "layer-chrome.png");
    const textPaths = texts.map((_, i) => join(workDir, `layer-text-${i + 1}.png`));
    const endPath = join(workDir, "layer-end.png");
    const [chromePng, endPng, ...textPngs] = await Promise.all([
      renderLayer(<ChromeLayer th={th} credit={params.credit} darkFrom={darkFrom} darkTo={darkTo} darkEnd={darkEnd} portrait={Boolean(cropped)} />, fonts),
      renderLayer(<EndCard th={th} es={params.locale === "es"} />, fonts),
      ...texts.map((s) => renderLayer(s.node, fonts)),
    ]);
    await Promise.all([
      writeFile(photoPath, photo),
      writeFile(chromePath, chromePng),
      writeFile(endPath, endPng),
      ...textPngs.map((png, i) => writeFile(textPaths[i], png)),
    ]);

    const f = (n: number) => n.toFixed(3);
    const still = (p: string) => ["-loop", "1", "-framerate", String(FPS), "-t", f(total), "-i", p];
    const inputs = [
      "-i", photoPath, // 0
      ...still(chromePath), // 1
      ...textPaths.flatMap(still), // 2 .. 1+texts
      ...still(endPath), // 2+texts
      "-i", musicPath,
    ];
    const endInput = 2 + texts.length;
    const audioInput = endInput + 1;

    // The movement: a window onto the photo layer, eased 0 -> 1 through the
    // reel, sampled with sub-pixel precision by perspective (bicubic). Not
    // zoompan: it moves in whole pixels, which measured as visible judder
    // once the photo also pans (frame-to-frame motion varying ~28%).
    const ease = `((1-cos(PI*in/${frames}))/2)`;
    const zoom = `(1+${ZOOM}*${ease})`;
    const left = `((W-W/${zoom})*(${(1 - PAN_X) / 2}+${PAN_X}*${ease}))`;
    const top = `((H-H/${zoom})*(${(1 + PAN_Y) / 2}-${PAN_Y}*${ease}))`;
    const right = `(${left}+W/${zoom})`;
    const bottom = `(${top}+H/${zoom})`;
    const sw = W * SS;
    const sh = H * SS;
    const filters: string[] = [
      // Blurred fill: blurred small (cheap), then scaled back up.
      `[0:v]split[pa][pb]`,
      `[pa]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=12:2,eq=brightness=-0.18:saturation=0.8,scale=${sw}:${sh}[fill]`,
      `[pb]scale=${sw}:-2:flags=lanczos,crop=iw:'min(ih,${photoMaxH * SS})':0:0[fg]`,
      `[fill][fg]overlay=0:${photoTop * SS},format=yuv444p,loop=loop=${frames - 1}:size=1,settb=1/${FPS},setpts=N,` +
        `perspective=x0='${left}':y0='${top}':x1='${right}':y1='${top}':x2='${left}':y2='${bottom}':x3='${right}':y3='${bottom}':interpolation=cubic:sense=source:eval=frame,` +
        `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p[bg]`,
      `[bg][1:v]overlay=0:0:format=auto[v0]`,
    ];
    let last = "v0";
    texts.forEach((s, i) => {
      const start = starts[i];
      const end = start + s.seconds;
      // Fades in OVERLAP early, over the previous scene's fade-out.
      const inAt = i === 0 ? start : start - OVERLAP;
      const fadeIn = i === 0 ? "" : `fade=t=in:st=${f(inAt)}:d=${TRANS_IN}:alpha=1,`;
      filters.push(`[${2 + i}:v]format=rgba,${fadeIn}fade=t=out:st=${f(end - TRANS_OUT)}:d=${TRANS_OUT}:alpha=1[t${i}]`);
      // Eased slide: up into place while entering (the hook is already in
      // place at t=0), drifting up while leaving.
      const rise = i === 0 ? "0" : `${SLIDE}*pow(1-clip((t-${f(inAt)})/${TRANS_IN}\\,0\\,1)\\,2)`;
      const drift = `${DRIFT}*(1-pow(1-clip((t-${f(end - TRANS_OUT)})/${TRANS_OUT}\\,0\\,1)\\,2))`;
      filters.push(`[${last}][t${i}]overlay=x=0:y='${rise}-${drift}':enable='between(t\\,${f(inAt)}\\,${f(end)})'[v${i + 1}]`);
      last = `v${i + 1}`;
    });
    filters.push(`[${endInput}:v]format=rgba,fade=t=in:st=${f(endStart - OVERLAP)}:d=0.4:alpha=1[end]`);
    filters.push(`[${audioInput}:a]atrim=0:${f(total)},afade=t=out:st=${f(total - 1.5)}:d=1.5,loudnorm=I=-16:TP=-1.5,aresample=44100[aout]`);
    filters.push(`[${last}][end]overlay=0:0:enable='gte(t\\,${f(endStart - OVERLAP)})'[vend]`);
    filters.push(`color=c=${th.accent.replace("#", "0x")}:s=${W}x${PROGRESS_H}:r=${FPS}:d=${f(total)}[bar]`);
    filters.push(`[vend][bar]overlay=x='-w+w*t/${f(total)}':y=0,format=yuv420p,setsar=1[vout]`);

    const outPath = join(workDir, "reel.mp4");
    const args = [
      "-y",
      ...inputs,
      "-filter_complex", filters.join(";"),
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "18",
      // Even quality from frame to frame: the default quality steps between
      // frame types read as a faint pulsing on a slowly moving photo.
      "-x264-params", "ipratio=1.0:pbratio=1.0:aq-mode=3", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k",
      "-t", f(total),
      "-movflags", "+faststart",
      outPath,
    ];
    await execFileAsync(ffmpegPath, args, { maxBuffer: 32 * 1024 * 1024 });
    return await readFile(outPath);
  } finally {
    if (!params.keepScenesDir) await rm(workDir, { recursive: true, force: true });
  }
}
