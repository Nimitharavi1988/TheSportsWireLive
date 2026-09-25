import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SmartDisplayIcon from "@mui/icons-material/SmartDisplay";
import type { SxProps, Theme } from "@mui/material/styles";
import { ScrollRow } from "@/components/ScrollRow";
import { relativeTime } from "@/lib/relativeTime";
import { fetchLatestVideos, fetchMatchVideo, type VideoItem } from "@/lib/videos/queries";
import { VideoPlayer } from "./VideoPlayer";

// Card width: on a phone (xs) a bit over one card fits, so the next card
// peeking in signals the row scrolls; wider from sm up. Same outlined-card
// strip treatment as Player News.
const CARD_WIDTH = { xs: 248, sm: 288 };
// Two clamped title lines at body2 — reserved even for one-line titles so
// every card in the row has the same height.
const TITLE_MIN_HEIGHT = "2.86em";

function VideosHeading({ headingSx }: { headingSx?: SxProps<Theme> }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
      <SmartDisplayIcon sx={{ fontSize: 20, color: "error.main" }} />
      <Typography variant="h5" sx={headingSx}>Videos</Typography>
    </Stack>
  );
}

// "Videos" strip: the latest official league/broadcaster uploads, playable
// in place (see VideoPlayer). Server component; only the player is client.
export function VideoStrip({ videos, headingSx }: { videos: VideoItem[]; headingSx?: SxProps<Theme> }) {
  if (videos.length === 0) return null;
  return (
    <Box component="section" aria-label="Videos" sx={{ mb: 4 }}>
      <VideosHeading headingSx={headingSx} />
      <ScrollRow>
        {videos.map((v) => (
          <Paper key={v.youtubeId} variant="outlined" sx={{ width: CARD_WIDTH, flexShrink: 0, overflow: "hidden" }}>
            <VideoPlayer youtubeId={v.youtubeId} title={v.title} sizes="(max-width: 600px) 248px, 288px" rounded={false} />
            <Box sx={{ p: 1.25 }}>
              <Typography
                variant="body2"
                title={v.title}
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
                {v.title}
              </Typography>
              <Typography variant="caption" noWrap component="p" sx={{ color: "text.secondary", mt: 0.5 }}>
                {v.channelTitle} · {relativeTime(v.publishedAt)}
              </Typography>
            </Box>
          </Paper>
        ))}
      </ScrollRow>
    </Box>
  );
}

// Same footprint as VideoStrip while its query streams in, so the sections
// below don't jump when it arrives.
export function VideoStripSkeleton({ headingSx }: { headingSx?: SxProps<Theme> }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <VideosHeading headingSx={headingSx} />
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
  const videos = await fetchLatestVideos({ category }).catch(() => []);
  return <VideoStrip videos={videos} headingSx={headingSx} />;
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
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Highlights</Typography>
      </Stack>
      <VideoPlayer youtubeId={video.youtubeId} title={video.title} sizes="(max-width: 900px) 100vw, 800px" />
      <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "text.secondary" }}>
        {video.title} · {video.channelTitle} on YouTube
      </Typography>
    </Box>
  );
}
