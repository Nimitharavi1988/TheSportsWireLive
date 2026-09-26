import Link from "next/link";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SmartDisplayIcon from "@mui/icons-material/SmartDisplay";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { SxProps, Theme } from "@mui/material/styles";
import { ScrollRow } from "@/components/ScrollRow";
import { relativeTime } from "@/lib/relativeTime";
import { fetchLatestVideos, fetchMatchVideo, videoSport, type VideoItem } from "@/lib/videos/queries";
import { VideoPlayer } from "./VideoPlayer";

// Card width in strips: on a phone (xs) a bit over one card fits, so the
// next card peeking in signals the row scrolls; wider from sm up. Same
// outlined-card treatment as Player News.
const CARD_WIDTH = { xs: 248, sm: 288 };
// Two clamped title lines at body2 — reserved even for one-line titles so
// every card in a row has the same height.
const TITLE_MIN_HEIGHT = "2.86em";

export function videosHref(category?: string | null): string {
  const sport = videoSport(category);
  return sport ? `/videos?category=${sport}` : "/videos";
}

// One video card — strips and the /videos grid share it.
export function VideoCard({ video, sizes, sx }: { video: VideoItem; sizes: string; sx?: SxProps<Theme> }) {
  return (
    <Paper variant="outlined" sx={[{ overflow: "hidden", display: "flex", flexDirection: "column" }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <VideoPlayer youtubeId={video.youtubeId} title={video.title} sizes={sizes} rounded={false} />
      <Box sx={{ p: 1.25 }}>
        <Typography
          variant="body2"
          component="h3"
          title={video.title}
          sx={{
            fontWeight: 600,
            lineHeight: 1.43,
            minHeight: TITLE_MIN_HEIGHT,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {video.title}
        </Typography>
        <Typography variant="caption" noWrap component="p" sx={{ color: "text.secondary", mt: 0.5 }}>
          {video.channelTitle} · {relativeTime(video.publishedAt)}
        </Typography>
      </Box>
    </Paper>
  );
}

function VideosHeading({ title, headingSx, moreHref }: { title: string; headingSx?: SxProps<Theme>; moreHref?: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
      <SmartDisplayIcon sx={{ fontSize: 20, color: "error.main" }} />
      <Typography variant="h5" component="h2" sx={[{ flex: 1 }, ...(Array.isArray(headingSx) ? headingSx : [headingSx])]}>
        {title}
      </Typography>
      {moreHref && (
        <Link href={moreHref} style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center" }}>
            All videos <ChevronRightIcon sx={{ fontSize: 18 }} />
          </Typography>
        </Link>
      )}
    </Stack>
  );
}

// "See all videos" card closing a strip — the scroll's natural end leads
// on to /videos instead of stopping.
function SeeAllCard({ href }: { href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
      <Paper
        variant="outlined"
        sx={{
          width: { xs: 140, sm: 160 },
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          p: 2,
          textAlign: "center",
          transition: "border-color 0.15s",
          "&:hover": { borderColor: "primary.main" },
        }}
      >
        <SmartDisplayIcon sx={{ fontSize: 32, color: "error.main" }} />
        <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>
          See all videos
        </Typography>
      </Paper>
    </Link>
  );
}

// Horizontal strip of the latest official videos, playable in place (see
// VideoPlayer). Server component; only the player is client.
export function VideoStrip({
  videos,
  title = "Videos",
  headingSx,
  moreHref,
}: {
  videos: VideoItem[];
  title?: string;
  headingSx?: SxProps<Theme>;
  moreHref?: string;
}) {
  if (videos.length === 0) return null;
  return (
    <Box component="section" aria-label={title} sx={{ mb: 4 }}>
      <VideosHeading title={title} headingSx={headingSx} moreHref={moreHref} />
      <ScrollRow>
        {videos.map((v) => (
          <VideoCard key={v.youtubeId} video={v} sizes="(max-width: 600px) 248px, 288px" sx={{ width: CARD_WIDTH, flexShrink: 0 }} />
        ))}
        {moreHref && <SeeAllCard href={moreHref} />}
      </ScrollRow>
    </Box>
  );
}

// Same footprint as VideoStrip while its query streams in, so the sections
// below don't jump when it arrives.
export function VideoStripSkeleton({ title = "Videos", headingSx }: { title?: string; headingSx?: SxProps<Theme> }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <VideosHeading title={title} headingSx={headingSx} />
      <ScrollRow>
        {[...Array(4)].map((_, i) => (
          <Paper key={i} variant="outlined" sx={{ width: CARD_WIDTH, flexShrink: 0, overflow: "hidden" }}>
            <Box sx={{ aspectRatio: "16 / 9", bgcolor: "action.hover" }} />
            <Box sx={{ p: 1.25 }}>
              <Box sx={{ height: 36, borderRadius: 0.5, bgcolor: "action.hover" }} />
              <Box sx={{ width: "50%", height: 12, mt: 1, borderRadius: 0.5, bgcolor: "action.hover" }} />
            </Box>
          </Paper>
        ))}
      </ScrollRow>
    </Box>
  );
}

// Data-fetching wrappers, rendered inside <Suspense> so the video query
// never holds up the rest of the page. A failed query just hides the
// section — videos are never worth an error page.
export async function LatestVideos({ category, headingSx }: { category?: string; headingSx?: SxProps<Theme> }) {
  // No fallback here: a sport with no videos shows no strip, so the link
  // only ever appears alongside that sport's own videos.
  const videos = await fetchLatestVideos({ category }).catch(() => []);
  return <VideoStrip videos={videos} headingSx={headingSx} moreHref={videosHref(category)} />;
}

// "Watch" strip at the end of every article — most visitors arrive on an
// article straight from Facebook and never see the homepage, so this is
// where they discover the videos. Same sport as the story, falling back to
// every sport; the story's own highlights (shown at its top) are left out.
export async function ArticleVideos({ articleId, category }: { articleId: string; category: string }) {
  const videos = await fetchLatestVideos({ category, limit: 8, excludeMatchArticleId: articleId, fallbackToAll: true }).catch(() => []);
  // Link to the sport's filter only when the strip is that sport's videos —
  // after the all-sports fallback it would open an empty page.
  const sport = videoSport(category);
  const moreHref = videos.every((v) => v.category === sport) ? videosHref(category) : "/videos";
  return <VideoStrip videos={videos} title="Watch" moreHref={moreHref} headingSx={{ fontSize: "1.25rem", fontWeight: 700 }} />;
}

export async function MatchHighlightsForArticle({ articleId }: { articleId: string }) {
  const video = await fetchMatchVideo(articleId).catch(() => null);
  return video ? <MatchHighlights video={video} /> : null;
}

// Highlights of this match, under the scoreboard on a match story.
export function MatchHighlights({ video }: { video: VideoItem }) {
  return (
    <Box component="section" aria-label="Match highlights" sx={{ mb: 3 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
        <SmartDisplayIcon sx={{ fontSize: 20, color: "error.main" }} />
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>Highlights</Typography>
      </Stack>
      <VideoPlayer youtubeId={video.youtubeId} title={video.title} sizes="(max-width: 900px) 100vw, 800px" />
      <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "text.secondary" }}>
        {video.title} · {video.channelTitle} on YouTube
      </Typography>
    </Box>
  );
}
