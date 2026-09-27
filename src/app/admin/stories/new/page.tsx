import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { getSession } from "@/lib/auth";
import { StoryEditor } from "../StoryEditor";
import { storyCategories, storySeriesOptions } from "../editorData";
import { tagOptions } from "@/lib/tags";

export const metadata = { title: "Write a story", robots: { index: false } };

export default async function NewStoryPage() {
  if (!(await getSession())) redirect("/admin/login");
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs steps={[{ name: "Admin", href: "/admin" }, { name: "Stories", href: "/admin/stories" }]} current="Write a story" />
      <Typography variant="h4" sx={{ mb: 3 }}>Write a story</Typography>
      <StoryEditor
        categories={storyCategories()}
        seriesOptions={await storySeriesOptions()}
        tagOptions={tagOptions()}
        initial={{ title: "", summary: "", body: "", category: "cricket", storyKind: "analysis", heroImageUrl: null, heroImageCredit: "", heroImageCreditUrl: null, authorName: "", authorBio: "", original: true, hasByline: true, seriesKey: null, tags: [] }}
      />
    </Container>
  );
}
