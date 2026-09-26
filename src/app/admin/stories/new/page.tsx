import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { StoryEditor } from "../StoryEditor";
import { storyCategories, storySeriesOptions } from "../editorData";
import { tagOptions } from "@/lib/tags";

export const metadata = { title: "Write a story", robots: { index: false } };

export default async function NewStoryPage() {
  if (!(await getSession())) redirect("/admin/login");
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Link href="/admin/stories" style={{ fontSize: 14 }}>← Stories</Link>
      <Typography variant="h4" sx={{ mt: 1, mb: 3 }}>Write a story</Typography>
      <StoryEditor
        categories={storyCategories()}
        seriesOptions={await storySeriesOptions()}
        tagOptions={tagOptions()}
        initial={{ title: "", summary: "", body: "", category: "cricket", storyKind: "analysis", heroImageUrl: null, heroImageCredit: "", authorName: "", authorBio: "", original: true, hasByline: true, seriesKey: null, tags: [] }}
      />
    </Container>
  );
}
