import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { getSession } from "@/lib/auth";
import { StoryEditor } from "../StoryEditor";
import { storyCategories, storySeriesOptions } from "../editorData";
import { tagOptions } from "@/lib/tags";
import { fetchStoryIdea } from "@/lib/storyIdeasData";

export const metadata = { title: "Write a story", robots: { index: false } };

type Props = { searchParams: Promise<{ idea?: string }> };

// ?idea= comes from Story ideas (/admin/stories/ideas): the editor opens
// with that idea's sport, kind, series and tags, and its brief ready for
// Draft with AI.
export default async function NewStoryPage(props: Props) {
  if (!(await getSession())) redirect("/admin/login");
  const ideaKey = (await props.searchParams).idea;
  const idea = ideaKey ? await fetchStoryIdea(ideaKey) : null;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs steps={[{ name: "Admin", href: "/admin" }, { name: "Stories", href: "/admin/stories" }]} current="Write a story" />
      <Typography variant="h4" sx={{ mb: 3 }}>Write a story</Typography>
      <StoryEditor
        categories={storyCategories()}
        seriesOptions={await storySeriesOptions(idea?.seriesKey)}
        tagOptions={tagOptions()}
        idea={idea ? { key: idea.key, headline: idea.headline, reason: idea.reason, brief: idea.brief } : undefined}
        initial={{
          title: "",
          summary: "",
          body: "",
          category: idea?.sport ?? "cricket",
          storyKind: idea?.storyKind ?? "analysis",
          heroImageUrl: null,
          heroImageCredit: "",
          heroImageCreditUrl: null,
          authorName: "",
          authorBio: "",
          original: true,
          hasByline: true,
          seriesKey: idea?.seriesKey ?? null,
          tags: idea?.tags ?? [],
        }}
      />
    </Container>
  );
}
