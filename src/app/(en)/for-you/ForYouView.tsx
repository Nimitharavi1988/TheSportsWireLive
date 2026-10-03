import { cookies } from "next/headers";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Link from "next/link";
import { followKey, parseFollows, readFollowsFrom } from "@/lib/follows";
import { resolveAllFollows } from "@/lib/competitions";
import { fetchFollowingArticles } from "@/lib/myFeed";
import { FollowManager } from "@/components/FollowManager";
import { StoryGrid } from "@/components/StoryGrid";
import { getDict } from "@/lib/i18n/dictionary";

// Unlike the homepage (ISR-cached, so it must never read a per-visitor
// cookie — see preferences.ts), this page exists only to be personal, so
// it renders per request and reads the follows cookie server-side.
export function forYouMetadata(locale?: string) {
  const t = getDict(locale).forYou;
  return { title: t.metaTitle, description: t.metaDescription, robots: { index: false } };
}

// The For You feed for English or a language edition (its sports, translated stories).
export async function ForYouView({ only, locale }: { only?: string; locale?: string }) {
  const t = getDict(locale).forYou;
  const store = await cookies();
  const refs = readFollowsFrom((name) => store.get(name)?.value);
  const entities = await resolveAllFollows(refs);
  // ?only=club:arsenal narrows the feed to one follow (the filter chips in
  // FollowManager). Ignored unless it's something the visitor actually
  // follows — an unfollowed or stale value just shows everything.
  const onlyKey = only ? parseFollows(only).map(followKey)[0] : undefined;
  const active = entities.find((e) => followKey(e) === onlyKey) ?? null;
  const articles = entities.length > 0 ? await fetchFollowingArticles(active ? [active] : refs, 30, locale) : [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ maxWidth: 760 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t.title}
        </Typography>
        <Typography sx={{ color: "text.secondary", mb: 3 }}>
          {entities.length > 0
            ? t.subtitleHas
            : t.subtitleEmpty}
        </Typography>

        <FollowManager initialEntities={entities} activeKey={active ? followKey(active) : null} />

        {active && (
          <Typography sx={{ fontSize: 14, color: "text.secondary", mb: 1 }}>
            {t.showingOnly(active.name)} ·{" "}
            <Link href={active.href} style={{ color: "inherit", fontWeight: 600 }}>
              {t.goToPage(active.name)}
            </Link>
          </Typography>
        )}

        {entities.length > 0 && articles.length === 0 && (
          <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
            {active
              ? t.noneActive(active.name)
              : t.noneAll}
          </Typography>
        )}
      </Box>

      {/* Full width, the same card grid as Analysis (StoryGrid) — the
          follow controls above stay at a readable width. */}
      {articles.length > 0 && (
        <Box component="section" aria-label={t.storiesAria} sx={{ mt: 3 }}>
          <StoryGrid items={articles.map((a) => ({ ...a, footer: a.matchedFollows.join(", ") || null }))} locale={locale} />
        </Box>
      )}
    </Container>
  );
}
