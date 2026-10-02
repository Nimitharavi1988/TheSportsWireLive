import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ilike } from "drizzle-orm";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import { db } from "@/db";
import { article } from "@/db/schema";
import { ArticleRow } from "@/components/ArticleRow";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { displaySummary } from "@/lib/articleSummary";
import { MEDAL_LABEL, plainName, type MedalKind } from "@/lib/events/athletes";
import { findAthlete, getAthleteProfile } from "@/lib/events/athleteRead";
import { EVENT_HUBS } from "@/lib/events/eventHubs";

// An athlete who medalled at a Games: photo and bio from their Wikipedia
// article, the medals they won there, and our stories that name them. Exists
// only for someone on a stored medallists list (athleteSync.ts). Cached like the
// other detail pages: rendered on first visit, refreshed hourly.
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

const COLOR: Record<MedalKind, string> = { gold: "#d4af37", silver: "#a8a9ad", bronze: "#b87333" };
const GAMES_NAME: Record<string, string> = { "asian-games-2026": "2026 Asian Games" };

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const athlete = await findAthlete(slug);
  if (!athlete) return {};
  const profile = await getAthleteProfile(slug);
  const games = GAMES_NAME[athlete.eventKey] ?? "the Games";
  const medals = athlete.medals.map((m) => `${MEDAL_LABEL[m.medal].toLowerCase()} in ${m.event}`).join(", ");
  return {
    title: `${athlete.name} — ${athlete.country} at the ${games}`,
    description: `${profile?.description ? `${profile.description}. ` : ""}${athlete.name} won ${medals} at the ${games}.`.slice(0, 300),
    alternates: { canonical: `/athlete/${slug}` },
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export default async function AthletePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const athlete = await findAthlete(slug);
  if (!athlete) notFound();
  const profile = await getAthleteProfile(slug);
  const games = GAMES_NAME[athlete.eventKey] ?? "the Games";
  const name = profile?.name ?? plainName(athlete.title);
  const hub = EVENT_HUBS[athlete.eventKey];

  // Stories that name them — only for a name of two or more words, so
  // "Kamaljeet" alone can't pull in every story with that word.
  const fullName = plainName(athlete.title);
  const stories = fullName.includes(" ")
    ? await db.select().from(article).where(and(eq(article.status, "published"), ilike(article.title, `%${escapeLike(fullName)}%`))).orderBy(desc(article.publishedAt)).limit(8)
    : [];

  const counts = (["gold", "silver", "bronze"] as MedalKind[]).map((k) => ({ k, n: athlete.medals.filter((m) => m.medal === k).length })).filter((c) => c.n > 0);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs
        steps={[{ name: "Home", href: "/" }, { name: "Series", href: "/series" }, { name: games, href: `/series/${athlete.eventKey}` }]}
        current={name}
      />

      <Box sx={{ display: "flex", gap: { xs: 2, sm: 3 }, alignItems: "flex-start", mb: 3 }}>
        {profile?.thumbnail && (
          // A plain <img>: a small Wikimedia thumbnail, credited below.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.thumbnail} alt={name} width={120} height={120} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, flexShrink: 0, background: "#eee" }} />
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1">{name}</Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            {profile?.description ? `${profile.description} · ` : ""}{athlete.country} · {games}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
            {counts.map(({ k, n }) => (
              <Box key={k} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.4, border: "1px solid", borderColor: "divider", borderRadius: 5, fontSize: 13.5, fontWeight: 600, bgcolor: "background.paper" }}>
                <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: COLOR[k] }} />
                {n} {MEDAL_LABEL[k].toLowerCase()}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {profile?.extract && (
        <Box component="section" aria-label="About" sx={{ mb: 3 }}>
          <Typography component="p" sx={{ lineHeight: 1.7 }}>{profile.extract}</Typography>
          <Typography component="div" sx={{ mt: 0.75, fontSize: 12, color: "text.disabled" }}>
            From{" "}
            <a href={profile.pageUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Wikipedia</a>
            {" "}(CC BY-SA 4.0)
          </Typography>
        </Box>
      )}

      <Box component="section" aria-label={`Medals at the ${games}`} sx={{ mb: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden" }}>
        <Typography component="h2" sx={{ px: 2, py: 1.25, fontSize: 15, fontWeight: 700 }}>Medals at the {games}</Typography>
        {athlete.medals.map((m, i) => (
          <Box key={`${m.event}${i}`} sx={{ display: "flex", gap: 1.25, px: 2, py: 1.1, borderTop: "1px solid", borderColor: "divider" }}>
            <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: COLOR[m.medal], flexShrink: 0, mt: "5px" }} />
            <Box component="span" sx={visuallyHidden}>{MEDAL_LABEL[m.medal]}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography component="div" sx={{ fontSize: 14.5, fontWeight: 600 }}>{m.sport} — {m.event}</Typography>
              <Typography component="div" sx={{ fontSize: 13, color: "text.secondary" }}>
                {m.team ? `${m.team} · ` : m.athletes.length > 1 ? `With ${m.athletes.filter((a) => a.title !== athlete.title).map((a) => a.name).join(", ")} · ` : ""}{m.date}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {stories.length > 0 && (
        <Box component="section" aria-label="In the news" sx={{ mb: 3 }}>
          <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>In the news</Typography>
          {stories.map((a) => (
            <ArticleRow key={a.id} article={a} summary={displaySummary(a)} />
          ))}
        </Box>
      )}

      {hub && (
        <Link href={`/series/${athlete.eventKey}`} style={{ fontSize: 14, fontWeight: 600 }}>
          All {athlete.country} medallists at the {games} ›
        </Link>
      )}
    </Container>
  );
}
