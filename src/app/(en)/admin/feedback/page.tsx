import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { getSession } from "@/lib/auth";
import { listFeedback, setFeedbackHandled } from "@/lib/fanFeedbackStore";

export const metadata = { title: "Site feedback", robots: { index: false } };
export const dynamic = "force-dynamic";

async function toggle(id: string, handled: boolean) {
  "use server";
  if (!(await getSession())) return;
  await setFeedbackHandled(id, handled);
  revalidatePath("/admin/feedback");
}

// Private notes from the /feedback page, newest first within each group
// (unhandled on top). Nothing here is ever shown to other visitors.
export default async function FeedbackAdminPage() {
  if (!(await getSession())) redirect("/admin/login");
  const rows = await listFeedback();
  const open = rows.filter((r) => !r.handled);
  const up = rows.filter((r) => r.sentiment === "up").length;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs steps={[{ name: "Admin", href: "/admin" }]} current="Site feedback" />
      <Typography variant="h4" sx={{ mb: 1 }}>Site feedback ({open.length} to read)</Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>
        Last {rows.length}: {up} thumbs up, {rows.length - up} thumbs down. Mark a note handled once you have acted on it or decided not to.
      </Typography>
      {rows.length === 0 && <Typography sx={{ color: "text.secondary" }}>No feedback yet.</Typography>}
      <Stack spacing={1.5}>
        {rows.map((r) => (
          <Card key={r.id} variant="outlined" sx={{ p: 2, opacity: r.handled ? 0.6 : 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
              {r.sentiment === "up" ? "👍" : "👎"} {r.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC{r.page ? ` · from ${r.page}` : ""}
            </Typography>
            <Typography sx={{ mb: 1.5, color: r.note ? "text.primary" : "text.secondary" }}>{r.note ?? "No note"}</Typography>
            <form action={toggle.bind(null, r.id, !r.handled)}>
              <Button type="submit" size="small" color="inherit" variant="outlined">{r.handled ? "Mark unread" : "Mark handled"}</Button>
            </form>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
