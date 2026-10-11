import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { getSession } from "@/lib/auth";
import { bumpAppEventQuietly } from "@/lib/appEvents";
import { listPendingVoices, reviewVoice } from "@/lib/fanFeedbackStore";

export const metadata = { title: "Fan Voices review", robots: { index: false } };
export const dynamic = "force-dynamic";

async function review(id: string, status: "approved" | "rejected") {
  "use server";
  if (!(await getSession())) return;
  await reviewVoice(id, status);
  if (status === "approved") await bumpAppEventQuietly("fan_voice_approved");
  revalidatePath("/admin/fan-voices");
}

// Fans' takes wait here until a person approves them; approved takes appear
// under "Fans say" on the match page, rejected ones never do.
export default async function FanVoicesAdminPage() {
  if (!(await getSession())) redirect("/admin/login");
  const pending = await listPendingVoices();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SiteBreadcrumbs steps={[{ name: "Admin", href: "/admin" }]} current="Fan Voices" />
      <Typography variant="h4" sx={{ mb: 1 }}>Fan Voices ({pending.length} waiting)</Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>
        Approve takes that are about the match, civil and in the fan&apos;s own words. Reject spam, abuse, adverts, anything with personal details, and anything you would not want under our name.
      </Typography>
      {pending.length === 0 && <Typography sx={{ color: "text.secondary" }}>Nothing waiting. New takes appear here.</Typography>}
      <Stack spacing={1.5}>
        {pending.map((v) => (
          <Card key={v.id} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
              On <Link href={`/article/${v.slug}`} target="_blank" style={{ color: "inherit" }}>{v.title}</Link> · {v.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
            </Typography>
            <Typography sx={{ mb: 0.5 }}>&ldquo;{v.body}&rdquo;</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
              {v.name}{v.country ? `, ${v.country}` : ""}
            </Typography>
            <Stack direction="row" spacing={1}>
              <form action={review.bind(null, v.id, "approved")}>
                <Button type="submit" variant="contained" size="small" color="success">Approve</Button>
              </form>
              <form action={review.bind(null, v.id, "rejected")}>
                <Button type="submit" size="small" color="inherit">Reject</Button>
              </form>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
