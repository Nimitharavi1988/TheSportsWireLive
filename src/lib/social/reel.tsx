import { ImageResponse } from "next/og";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReactElement } from "react";
import type { PosterContent } from "@/lib/ingestion/commentary";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { loadHeroImageDataUri, BRAND_GREEN, PANEL } from "./instagramPoster";
import { generateReelMusic, type ReelMusicStyle } from "./reelMusic";

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
// Supersampling for the zoom: zoompan crops on whole input pixels, so at 3x
// each step is a third of an output pixel and the zoom doesn't judder.
const SS = 3;
// The whole photo layer zooms 1.00 -> 1.00+ZOOM once over the whole reel.
const ZOOM = 0.08;

// Text scenes play one after another over the moving photo: each fades
// (and its content slides up SLIDE px) in over FADE, and fades out over
// FADE before the next one comes in, so two sets of text never overlap.
const FADE = 0.35;
const SLIDE = 50;
const HOOK_SECONDS = 4;
const FACT_SECONDS = 2.8;
const END_SECONDS = 2.5;

function hookSize(hook: string): number {
  if (hook.length <= 38) return 92;
  if (hook.length <= 60) return 80;
  return 68;
}

function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: size, fontWeight: 700, color: "white", padding: "10px 22px 10px 16px", borderRadius: 12, background: "rgba(11,23,18,0.78)" }}>
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
function ChromeLayer({ credit }: { credit?: string | null }) {
  return (
    <Layer>
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", background: `linear-gradient(180deg, rgba(11,23,18,0.55) 0%, rgba(11,23,18,0) 14%, rgba(11,23,18,0) 46%, rgba(11,23,18,0.8) 62%, rgba(11,23,18,0.92) 100%)` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "150px 60px 0 60px", position: "relative" }}>
        <Wordmark />
        {credit && <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.8)", maxWidth: 420, textAlign: "right" }}>{credit}</div>}
      </div>
    </Layer>
  );
}

function HookText({ content, sportLabel }: { content: PosterContent; sportLabel: string | null }) {
  return (
    <Layer>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", padding: "0 60px 420px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          {sportLabel && (
            <div style={{ display: "flex", padding: "8px 18px", borderRadius: 8, background: BRAND_GREEN, color: "white", fontSize: 30, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginRight: 18 }}>
              {sportLabel}
            </div>
          )}
          <div style={{ display: "flex", color: "rgba(255,255,255,0.9)", fontSize: 30, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{content.eyebrow}</div>
        </div>
        <div style={{ display: "flex", color: "white", fontSize: hookSize(content.hook), fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5 }}>{content.hook}</div>
        <div style={{ display: "flex", width: 140, height: 10, borderRadius: 5, background: BRAND_GREEN, marginTop: 32 }} />
      </div>
    </Layer>
  );
}

function FactText({ row, index, total }: { row: { label: string; value: string }; index: number; total: number }) {
  const valueSize = row.value.length <= 14 ? 110 : row.value.length <= 30 ? 84 : 62;
  return (
    <Layer>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", margin: "0 60px 440px 60px", padding: "40px 48px 48px 48px", borderRadius: 24, background: "rgba(11,23,18,0.85)", borderLeft: `12px solid ${BRAND_GREEN}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", color: BRAND_GREEN, fontSize: 34, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{row.label}</div>
          <div style={{ display: "flex", color: "rgba(255,255,255,0.55)", fontSize: 28, fontWeight: 700 }}>
            {index + 1}/{total}
          </div>
        </div>
        <div style={{ display: "flex", color: "white", fontSize: valueSize, fontWeight: 700, lineHeight: 1.1 }}>{row.value}</div>
      </div>
    </Layer>
  );
}

// Opaque branded end card, fading in over everything.
function EndCard() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Poppins", background: `radial-gradient(circle at 50% 40%, #173a2a 0%, ${PANEL} 70%)` }}>
      <Wordmark size={64} />
      <div style={{ display: "flex", width: 160, height: 10, borderRadius: 5, background: BRAND_GREEN, margin: "56px 0" }} />
      <div style={{ display: "flex", color: "white", fontSize: 64, fontWeight: 700 }}>Full story</div>
      <div style={{ display: "flex", color: "rgba(255,255,255,0.8)", fontSize: 44, fontWeight: 600, marginTop: 12 }}>link in bio</div>
      <div style={{ display: "flex", color: BRAND_GREEN, fontSize: 48, fontWeight: 700, marginTop: 72 }}>sportswirelive.com</div>
      <div style={{ display: "flex", color: "rgba(255,255,255,0.7)", fontSize: 34, fontWeight: 600, marginTop: 20 }}>Follow @sportswirelivenews</div>
    </div>
  );
}

async function renderLayer(node: ReactElement, fonts: { bold: Buffer; semibold: Buffer }): Promise<Buffer> {
  const image = new ImageResponse(node, {
    width: W,
    height: H,
    fonts: [
      { name: "Poppins", data: fonts.bold, weight: 700, style: "normal" },
      { name: "Poppins", data: fonts.semibold, weight: 600, style: "normal" },
    ],
  });
  return Buffer.from(await image.arrayBuffer());
}

// Renders a ~15s vertical reel (1080x1920 H.264 MP4 with AAC music) from the same PosterContent the Instagram poster uses: the hook,
// each key fact in turn, then a branded end card. Satori renders the text
// as transparent layers; ffmpeg composites them over the photo, which
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
  // Also keep the layer PNGs here (for previewing); otherwise a temp dir.
  keepScenesDir?: string;
}): Promise<Buffer> {
  const ffmpegPath = (await import("ffmpeg-static")).default as unknown as string | null;
  if (!ffmpegPath) throw new Error("ffmpeg-static has no binary for this platform");

  const fontsDir = join(process.cwd(), "src/assets/fonts");
  const [bold, semibold] = await Promise.all([
    readFile(join(fontsDir, "Poppins-Bold.ttf")),
    readFile(join(fontsDir, "Poppins-SemiBold.ttf")),
  ]);
  const fonts = { bold, semibold };
  const photoDataUri = await loadHeroImageDataUri(params.heroImageUrl);
  const photo = Buffer.from(photoDataUri.slice(photoDataUri.indexOf(",") + 1), "base64");
  const sport = params.category ? categoryChipStyle(params.category.split("/")[0]) : null;
  const facts = params.content.rows.slice(0, 3);

  // Text scenes back to back; the end card starts where the last fact ends.
  const texts: { node: ReactElement; seconds: number }[] = [
    { node: <HookText content={params.content} sportLabel={sport?.label ?? null} />, seconds: HOOK_SECONDS },
    ...facts.map((row, i) => ({ node: <FactText row={row} index={i} total={facts.length} />, seconds: FACT_SECONDS })),
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
    if (!params.musicPath) await writeFile(musicPath, generateReelMusic(total, params.musicStyle));
    const chromePath = join(workDir, "layer-chrome.png");
    const textPaths = texts.map((_, i) => join(workDir, `layer-text-${i + 1}.png`));
    const endPath = join(workDir, "layer-end.png");
    const [chromePng, endPng, ...textPngs] = await Promise.all([
      renderLayer(<ChromeLayer credit={params.credit} />, fonts),
      renderLayer(<EndCard />, fonts),
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

    const sw = W * SS;
    const sh = H * SS;
    const filters: string[] = [
      // Blurred fill: blurred small (cheap), then scaled back up.
      `[0:v]split[pa][pb]`,
      `[pa]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=12:2,eq=brightness=-0.18:saturation=0.8,scale=${sw}:${sh}[fill]`,
      `[pb]scale=${sw}:-2:flags=lanczos,crop=iw:'min(ih,${PHOTO_MAX_H * SS})':0:0[fg]`,
      `[fill][fg]overlay=0:${PHOTO_TOP * SS},format=yuv420p,` +
        `zoompan=z='1+${ZOOM}*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}[bg]`,
      `[bg][1:v]overlay=0:0:format=auto[v0]`,
    ];
    let last = "v0";
    texts.forEach((s, i) => {
      const start = starts[i];
      const end = start + s.seconds;
      const fadeIn = i === 0 ? "" : `fade=t=in:st=${f(start)}:d=${FADE}:alpha=1,`;
      filters.push(`[${2 + i}:v]format=rgba,${fadeIn}fade=t=out:st=${f(end - FADE)}:d=${FADE}:alpha=1[t${i}]`);
      // Eased slide up into place (the hook is already in place at t=0).
      const y = i === 0 ? "0" : `${SLIDE}*pow(max(0\\,1-(t-${f(start)})/${FADE})\\,2)`;
      filters.push(`[${last}][t${i}]overlay=x=0:y='${y}':enable='between(t\\,${f(start)}\\,${f(end)})'[v${i + 1}]`);
      last = `v${i + 1}`;
    });
    filters.push(`[${endInput}:v]format=rgba,fade=t=in:st=${f(endStart)}:d=0.5:alpha=1[end]`);
    filters.push(`[${audioInput}:a]atrim=0:${f(total)},afade=t=out:st=${f(total - 1.5)}:d=1.5,loudnorm=I=-16:TP=-1.5,aresample=44100[aout]`);
    filters.push(`[${last}][end]overlay=0:0:enable='gte(t\\,${f(endStart)})',format=yuv420p,setsar=1[vout]`);

    const outPath = join(workDir, "reel.mp4");
    const args = [
      "-y",
      ...inputs,
      "-filter_complex", filters.join(";"),
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
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
