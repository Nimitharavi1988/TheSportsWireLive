import Link from "next/link";
import type { Metadata } from "next";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import SmartDisplayIcon from "@mui/icons-material/SmartDisplay";
import { Fragment } from "react";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { relativeTime } from "@/lib/relativeTime";
import { fetchVideoLibrary, fetchVideoSports, type VideoItem } from "@/lib/videos/queries";
import { splitLibrary, withAdSlots } from "@/lib/videos/videoStrip";
import { VideoCard } from "@/components/videos/VideoStrip";
import { VideoPlayer } from "@/components/videos/VideoPlayer";
import { InFeedAd } from "@/components/InFeedAd";

// Official league and broadcaster videos (src/lib/videos/): the library
// behind the Videos/Watch strips. New uploads arrive every ~15 minutes with
// ingestion, so a 5-minute ISR window is plenty.
export const revalidate = 300;

// Sports with an official channel (youtubeChannels.ts), in the site's nav
// order. A chip only shows while its sport has videos in the window — a
// chip that opens an empty page is a dead end.
const SPORT_ORDER = ["football", "cricket", "american-football", "basketball", "baseball", "hockey"];

type Props = { searchParams: Promise<{ category?: string }> };

function activeSport(raw: string | undefined): string | null {
  return raw && SPORT_ORDER.includes(raw) ? raw : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const sport = activeSport((await props.searchParams).category);
  const label = sport ? categoryChipStyle(sport).label : null;
  return {
    title: label ? `${label} Videos & Highlights` : "Sports Videos & Highlights",
    description: label
      ? `The latest official ${label} highlights and videos, updated through the day on Sports Wire Live.`
      : "Official highlights and videos from the Premier League, NFL, NBA, MLB, NHL, ICC and more, updated through the day on Sports Wire Live.",
    alternates: { canonical: sport ? `/videos?category=${sport}` : "/videos" },
  };
}

// Grid of cards with the site's in-feed ad units between rows (see
// withAdSlots) — one unit per breakpoint, same pair as article pages.
function VideoGrid({ videos, label }: { videos: VideoItem[]; label: string }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      {withAdSlots(videos).map((slot) =>
        slot.kind === "video" ? (
          <VideoCard key={slot.item.youtubeId} video={slot.item} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 380px" />
        ) : (
          <Box key={`${label}-ad-${slot.index}`} sx={{ gridColumn: "1 / -1" }}>
            <InFeedAd slot="6766570899" layoutKey="-i7+9-t-18+5h" sx={{ display: { xs: "block", md: "none" } }} />
            <InFeedAd slot="6355507350" layoutKey="-i7+9-t-18+5h" sx={{ display: { xs: "none", md: "block" } }} />
          </Box>
        )
      )}
    </Box>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <Typography variant="h5" component="h2" sx={{ fontFamily: "var(--font-body)", color: "text.secondary", fontWeight: 600, mt: 4, mb: 2 }}>
      {children}
    </Typography>
  );
}

// VideoObject list for search engines — the videos are YouTube-hosted, so
// embedUrl/contentUrl point there.
function videoJsonLd(videos: VideoItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: videos.slice(0, 20).map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "VideoObject",
        name: v.title,
        description: `${v.title} — ${v.channelTitle}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`,
        uploadDate: v.publishedAt.toISOString(),
        embedUrl: `https://www.youtube.com/embed/${v.youtubeId}`,
        contentUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
      },
    })),
  };
}

export default async function VideosPage(props: Props) {
  const sport = activeSport((await props.searchParams).category);
  const [videos, sportsWithVideos] = await Promise.all([
    fetchVideoLibrary({ category: sport ?? undefined }),
    fetchVideoSports(),
  ]);
  const { featured, highlights, latest } = splitLibrary(videos);
  const chips = [
    { label: "All", category: null as string | null },
    ...SPORT_ORDER.filter((s) => s === sport || sportsWithVideos.includes(s)).map((s) => ({ label: categoryChipStyle(s).label, category: s })),
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {videos.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd(videos)) }} />
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <SmartDisplayIcon sx={{ color: "error.main" }} />
        <Typography variant="h4" component="h1">
          Videos
        </Typography>
      </Stack>

      <Box component="nav" aria-label="Sports" sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
        {chips.map((f) => {
          const isActive = f.category === sport;
          return (
            <Link
              key={f.label}
              href={f.category ? `/videos?category=${f.category}` : "/videos"}
              aria-current={isActive ? "page" : undefined}
              style={{ textDecoration: "none" }}
            >
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  px: 1.75,
                  py: 0.6,
                  borderRadius: 5,
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: isActive ? "text.primary" : "divider",
                  bgcolor: isActive ? "text.primary" : "transparent",
                  color: isActive ? "background.paper" : "text.secondary",
                  "&:hover": isActive ? {} : { borderColor: "text.secondary", color: "text.primary" },
                }}
              >
                {f.label}
              </Box>
            </Link>
          );
        })}
      </Box>

      {!featured ? (
        <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
          No videos yet{sport ? ` for ${categoryChipStyle(sport).label}` : ""} — check back after today&apos;s games.
        </Typography>
      ) : (
        <>
          <Box component="section" aria-label="Featured video" sx={{ maxWidth: 960 }}>
            <VideoPlayer youtubeId={featured.youtubeId} title={featured.title} sizes="(max-width: 1000px) 100vw, 960px" />
            <Typography variant="h6" component="h2" sx={{ mt: 1.5, fontWeight: 700, lineHeight: 1.3 }}>
              {featured.title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              {featured.channelTitle} · {relativeTime(featured.publishedAt)}
            </Typography>
          </Box>

          {[
            { title: "Match Highlights", items: highlights },
            { title: "Latest", items: latest },
          ].map(
            (section) =>
              section.items.length > 0 && (
                <Fragment key={section.title}>
                  <SectionHeading>{section.title}</SectionHeading>
                  <VideoGrid videos={section.items} label={section.title} />
                </Fragment>
              )
          )}

          <Typography variant="caption" component="p" sx={{ color: "text.disabled", mt: 4 }}>
            Videos are from official league and broadcaster channels and play on YouTube.
          </Typography>
        </>
      )}
    </Container>
  );
}
