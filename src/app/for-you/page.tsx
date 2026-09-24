import { cookies } from "next/headers";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Link from "next/link";
import { followKey, parseFollows, readFollowsFrom } from "@/lib/follows";
import { resolveAllFollows } from "@/lib/competitions";
import { fetchFollowingArticles } from "@/lib/myFeed";
import { FollowManager } from "@/components/FollowManager";
import { ArticleRow } from "@/components/ArticleRow";

// Unlike the homepage (ISR-cached, so it must never read a per-visitor
// cookie — see preferences.ts), this page exists only to be personal, so
// it renders per request and reads the follows cookie server-side.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "For You — Your Teams, Players and Sports",
  description: "The latest stories about the teams, players, countries and sports you follow on Sports Wire Live.",
  robots: { index: false },
};

export default async function ForYouPage({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  const [store, { only }] = await Promise.all([cookies(), searchParams]);
  const refs = readFollowsFrom((name) => store.get(name)?.value);
  const entities = await resolveAllFollows(refs);
  // ?only=club:arsenal narrows the feed to one follow (the filter chips in
  // FollowManager). Ignored unless it's something the visitor actually
  // follows — an unfollowed or stale value just shows everything.
  const onlyKey = only ? parseFollows(only).map(followKey)[0] : undefined;
  const active = entities.find((e) => followKey(e) === onlyKey) ?? null;
  const articles = entities.length > 0 ? await fetchFollowingArticles(active ? [active] : refs, 30) : [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ maxWidth: 760 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          For You
        </Typography>
        <Typography sx={{ color: "text.secondary", mb: 3 }}>
          {entities.length > 0
            ? "The latest from everything you follow."
            : "Follow teams, players, countries or whole sports, and their latest stories will collect here."}
        </Typography>

        <FollowManager initialEntities={entities} activeKey={active ? followKey(active) : null} />

        {active && (
          <Typography sx={{ fontSize: 14, color: "text.secondary", mb: 1 }}>
            Showing {active.name} only ·{" "}
            <Link href={active.href} style={{ color: "inherit", fontWeight: 600 }}>
              Go to the {active.name} page
            </Link>
          </Typography>
        )}

        {entities.length > 0 &&
          (articles.length === 0 ? (
            <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
              {active
                ? `No recent stories about ${active.name} yet.`
                : "No recent stories for what you follow yet. Try following a few more teams or a whole sport."}
            </Typography>
          ) : (
            <Box component="section" aria-label="Your stories">
              {articles.map((a) => (
                <ArticleRow key={a.id} article={a} context={a.matchedFollows.join(", ") || null} />
              ))}
            </Box>
          ))}
      </Box>
    </Container>
  );
}
