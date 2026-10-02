import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import { getSession } from "@/lib/auth";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { IDEA_SPORTS, type IdeaKind, type StoryIdea } from "@/lib/storyIdeas";
import { fetchStoryIdeas, markStoryIdea } from "@/lib/storyIdeasData";

export const metadata = { title: "Story ideas", robots: { index: false } };
export const dynamic = "force-dynamic";

const SECTIONS: { kind: IdeaKind; title: string; blurb: string }[] = [
  { kind: "report", title: "Match reports", blurb: "Big matches from the last day and a half with no report of ours yet." },
  { kind: "preview", title: "Previews", blurb: "Big matches in the next two and a half days." },
  { kind: "trend", title: "In the news", blurb: "Players and teams many outlets are covering today — room for our own take." },
];

async function dismiss(key: string) {
  "use server";
  if (!(await getSession())) return;
  await markStoryIdea(key, "dismissed");
  revalidatePath("/admin/stories/ideas");
}

function IdeaCard({ idea }: { idea: StoryIdea }) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75, flexWrap: "wrap", gap: 0.5 }}>
        <Chip size="small" variant="outlined" label={categoryChipStyle(idea.sport).label} />
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{idea.reason}</Typography>
      </Stack>
      <Typography sx={{ fontWeight: 600, mb: idea.sources.length ? 0.75 : 1.5 }}>{idea.headline}</Typography>
      {idea.sources.length > 0 && (
        <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5 }}>
          {idea.sources.map((s) => (
            <Typography component="li" variant="body2" key={s.slug} sx={{ color: "text.secondary" }}>
              <Link href={`/article/${s.slug}`} target="_blank" style={{ color: "inherit" }}>{s.title}</Link> — {s.sourceName}
            </Typography>
          ))}
        </Box>
      )}
      <Stack direction="row" spacing={1}>
        <Link href={`/admin/stories/new?idea=${encodeURIComponent(idea.key)}`}>
          <Button variant="contained" size="small">Start story</Button>
        </Link>
        <form action={dismiss.bind(null, idea.key)}>
          <Button type="submit" size="small" color="inherit">Dismiss</Button>
        </form>
      </Stack>
    </Card>
  );
}

type Props = { searchParams: Promise<{ sport?: string }> };

// Pieces worth writing now (lib/storyIdeas.ts), worked out from the site's
// own match data and today's news. Start story opens the editor prefilled;
// nothing is written until the writer does it.
export default async function StoryIdeasPage(props: Props) {
  if (!(await getSession())) redirect("/admin/login");
  const raw = (await props.searchParams).sport;
  const sport = raw && (IDEA_SPORTS as readonly string[]).includes(raw) ? raw : null;
  const all = await fetchStoryIdeas();
  const ideas = sport ? all.filter((i) => i.sport === sport) : all;
  const chips = [{ label: `All (${all.length})`, value: null as string | null }, ...IDEA_SPORTS.map((s) => ({ label: `${categoryChipStyle(s).label} (${all.filter((i) => i.sport === s).length})`, value: s }))];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs steps={[{ name: "Admin", href: "/admin" }, { name: "Stories", href: "/admin/stories" }]} current="Story ideas" />
      <Typography variant="h4" sx={{ mb: 1 }}>Story ideas</Typography>
      <Typography sx={{ color: "text.secondary", mb: 2 }}>
        Start story opens the editor with the sport, kind, series and tags set and a brief for Draft with AI. An idea goes away once we publish on it.
      </Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 3 }}>
        {chips.map((c) => (
          <Link key={c.label} href={c.value ? `/admin/stories/ideas?sport=${c.value}` : "/admin/stories/ideas"}>
            <Chip label={c.label} clickable color={c.value === sport ? "primary" : "default"} variant={c.value === sport ? "filled" : "outlined"} />
          </Link>
        ))}
      </Stack>
      {ideas.length === 0 && <Typography sx={{ color: "text.secondary" }}>Nothing right now — check back after the next matches.</Typography>}
      {SECTIONS.map((section) => {
        const items = ideas.filter((i) => i.kind === section.kind);
        if (items.length === 0) return null;
        return (
          <Box component="section" key={section.kind} sx={{ mb: 4 }}>
            <Typography variant="h6" component="h2">{section.title}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>{section.blurb}</Typography>
            <Stack spacing={1.5}>
              {items.map((idea) => <IdeaCard key={idea.key} idea={idea} />)}
            </Stack>
          </Box>
        );
      })}
    </Container>
  );
}
