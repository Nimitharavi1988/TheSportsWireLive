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
import { fetchVideoLibrary, fetchVideoSports, searchVideos, type VideoItem } from "@/lib/videos/queries";
import SearchIcon from "@mui/icons-material/Search";
import { splitLibrary } from "@/lib/videos/videoStrip";
import { VideoCard } from "@/components/videos/VideoStrip";
import { VideoPlayer } from "@/components/videos/VideoPlayer";

// Official league and broadcaster videos (src/lib/videos/): the library
// behind the Videos/Watch strips. New uploads arrive every ~15 minutes with
// ingestion, so a 5-minute ISR window is plenty.
export const revalidate = 300;

// Sports with an official channel (youtubeChannels.ts), in the site's nav
// order. A chip only shows while its sport has videos in the window — a
// chip that opens an empty page is a dead end.
const SPORT_ORDER = ["football", "cricket", "american-football", "college-football", "basketball", "wnba", "baseball", "hockey"];

type Props = { searchParams: Promise<{ category?: string; q?: string; all?: string }> };

// Cards shown before "Show all": the full two-week library was ~160 cards
// and 656 KB of HTML (2026-09-27). Highlights get up to half.
const FIRST_PAGE = 48;

// The search box value, trimmed and length-capped.
function searchQuery(raw: string | undefined): string {
  return (raw ?? "").trim().slice(0, 80);
}

function activeSport(raw: string | undefined): string | null {
  return raw && SPORT_ORDER.includes(raw) ? raw : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.searchParams;
  const sport = activeSport(params.category);
  const label = sport ? categoryChipStyle(sport).label : null;
  return {
    // Search results are thin, endless variations of the same page.
    ...(searchQuery(params.q) ? { robots: { index: false, follow: true } } : {}),
    title: label ? `${label} Videos & Highlights` : "Sports Videos & Highlights",
    description: label
      ? `The latest official ${label} highlights and videos, updated through the day on Sports Wire Live.`
      : "Official highlights and videos from the Premier League, NFL, NBA, MLB, NHL, ICC and more, updated through the day on Sports Wire Live.",
    alternates: { canonical: sport ? `/videos?category=${sport}` : "/videos" },
  };
}

// Grid of video cards. No ads here: the videos are other channels' content
// (embedded YouTube), and ads beside content that isn't ours are a common
// reason for AdSense rejecting a site — ads run beside our own stories.
function VideoGrid({ videos }: { videos: VideoItem[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      {videos.map((video) => (
        <VideoCard key={video.youtubeId} video={video} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 380px" />
      ))}
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
  const params = await props.searchParams;
  const sport = activeSport(params.category);
  const q = searchQuery(params.q);
  const [videos, sportsWithVideos, results] = await Promise.all([
    q ? Promise.resolve([] as VideoItem[]) : fetchVideoLibrary({ category: sport ?? undefined }),
    fetchVideoSports(),
    q ? searchVideos(q, { category: sport ?? undefined }) : Promise.resolve(null),
  ]);
  // Chips keep the search: "Cricket" while searching "kohli" narrows it.
  const chipHref = (category: string | null) => {
    const qs = new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { q } : {}) }).toString();
    return qs ? `/videos?${qs}` : "/videos";
  };
  const library = splitLibrary(videos);
  const { featured } = library;
  const showAll = params.all === "1";
  const highlights = showAll ? library.highlights : library.highlights.slice(0, FIRST_PAGE / 2);
  const latest = showAll ? library.latest : library.latest.slice(0, FIRST_PAGE - highlights.length);
  const hidden = library.highlights.length + library.latest.length - highlights.length - latest.length;
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

      {/* A plain GET form: works without JavaScript and gives a shareable URL. */}
      <Box
        component="form"
        role="search"
        action="/videos"
        method="get"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          maxWidth: 520,
          mb: 2,
          px: 1.5,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 5,
          bgcolor: "background.paper",
          "&:focus-within": { borderColor: "text.secondary" },
        }}
      >
        <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} aria-hidden />
        {sport && <input type="hidden" name="category" value={sport} />}
        <Box
          component="input"
          type="search"
          name="q"
          defaultValue={q}
          maxLength={80}
          placeholder="Search videos — e.g. Kohli, India West Indies"
          aria-label="Search videos"
          sx={{ flex: 1, minWidth: 0, border: 0, outline: 0, py: 1, font: "inherit", fontSize: 15, bgcolor: "transparent", color: "text.primary" }}
        />
      </Box>

      <Box component="nav" aria-label="Sports" sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
        {chips.map((f) => {
          const isActive = f.category === sport;
          return (
            <Link
              key={f.label}
              href={chipHref(f.category)}
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

      {results ? (
        <Box component="section" aria-label="Search results">
          <Stack direction="row" spacing={2} sx={{ alignItems: "baseline", mb: 2, flexWrap: "wrap" }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {results.length === 0 ? "No videos" : `${results.length}${results.length === 60 ? "+" : ""} video${results.length === 1 ? "" : "s"}`} for &ldquo;{q}&rdquo;
              {sport ? ` in ${categoryChipStyle(sport).label}` : ""}
            </Typography>
            <Link href={sport ? `/videos?category=${sport}` : "/videos"} style={{ fontSize: 14 }}>
              Clear search
            </Link>
          </Stack>
          {results.length > 0 ? (
            <VideoGrid videos={results} />
          ) : (
            <Typography sx={{ color: "text.secondary", py: 4 }}>
              Try a player, team or competition — videos from the last two weeks are searched.
            </Typography>
          )}
        </Box>
      ) : !featured ? (
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
                  <VideoGrid videos={section.items} />
                </Fragment>
              )
          )}

          {hidden > 0 && (
            <Box sx={{ textAlign: "center", mt: 4 }}>
              <Link href={`/videos?${new URLSearchParams({ ...(sport ? { category: sport } : {}), all: "1" })}`} style={{ textDecoration: "none" }}>
                <Typography component="span" sx={{ fontWeight: 600, color: "primary.main" }}>
                  Show all videos ({hidden} more)
                </Typography>
              </Link>
            </Box>
          )}

          <Typography variant="caption" component="p" sx={{ color: "text.disabled", mt: 4 }}>
            Videos are from official league and broadcaster channels and play on YouTube.
          </Typography>
        </>
      )}
    </Container>
  );
}
