import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { featureArticle, unfeatureArticle, highlightArticle, unhighlightArticle } from "../actions";
import { HERO_CAP, sectionOf } from "@/lib/heroConfig";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Link from "next/link";

const HIGHLIGHT_DISPLAY_CAP = 4;

export default async function HomepageManagerPage(
  props: { searchParams: Promise<{ q?: string }> }
) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { q } = await props.searchParams;

  const [heroArticles, highlightArticles, searchResults] = await Promise.all([
    db.article.findMany({
      where: { status: "published", featured: true },
      orderBy: { featuredAt: "desc" },
    }),
    db.article.findMany({
      where: { status: "published", highlighted: true },
      orderBy: { highlightedAt: "desc" },
    }),
    q
      ? db.article.findMany({
          where: { status: "published", title: { contains: q, mode: "insensitive" } },
          orderBy: { publishedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h4">Homepage: hero &amp; highlights</Typography>
        <Link href="/admin" style={{ color: "inherit" }}>
          <Button variant="outlined" size="small">Back to review queue</Button>
        </Link>
      </Stack>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
        Manage which published articles appear in the homepage hero carousel and the Transfers &amp; Big News section.
      </Typography>

      <Box sx={{ mb: 5 }}>
        <Typography variant="h6" gutterBottom>
          Hero carousel
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Capped per section, not sitewide — up to {HERO_CAP} picks each for football, cricket, and NFL, so
          picking in one section never retires or blocks another. Picking a {HERO_CAP + 1}th within the same
          section auto-retires that section&apos;s oldest pick. Any remaining slots auto-fill with top trending
          stories on the homepage.
        </Typography>
        {heroArticles.length === 0 && (
          <Typography sx={{ color: "text.secondary" }}>Nothing picked — the hero is fully automatic right now.</Typography>
        )}
        {Object.entries(
          heroArticles.reduce<Record<string, typeof heroArticles>>((groups, article) => {
            const section = sectionOf(article.category);
            (groups[section] ??= []).push(article);
            return groups;
          }, {})
        ).map(([section, sectionArticles]) => (
          <Box key={section} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary", textTransform: "capitalize", mb: 1 }}>
              {section.replace("-", " ")} ({sectionArticles.length}/{HERO_CAP})
            </Typography>
            <Stack spacing={1}>
              {sectionArticles.map((article, i) => (
                <Card key={article.id} variant="outlined">
                  <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, "&:last-child": { pb: 2 } }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                      <Chip label={`#${i + 1}`} size="small" />
                      <Typography noWrap>{article.title}</Typography>
                    </Stack>
                    <form action={unfeatureArticle.bind(null, article.id)}>
                      <Button type="submit" size="small" color="inherit">Remove</Button>
                    </form>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        ))}
      </Box>

      <Box sx={{ mb: 5 }}>
        <Typography variant="h6" gutterBottom>
          Highlights — Transfers &amp; Big News ({highlightArticles.length} picked, latest {HIGHLIGHT_DISPLAY_CAP} shown on homepage)
        </Typography>
        {highlightArticles.length === 0 && (
          <Typography sx={{ color: "text.secondary" }}>
            Nothing pinned — the section falls back to automatic keyword matches only.
          </Typography>
        )}
        <Stack spacing={1}>
          {highlightArticles.map((article, i) => (
            <Card key={article.id} variant="outlined">
              <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, "&:last-child": { pb: 2 } }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                  {i < HIGHLIGHT_DISPLAY_CAP ? (
                    <Chip label={`#${i + 1}`} size="small" color="warning" />
                  ) : (
                    <Chip label="not shown" size="small" variant="outlined" />
                  )}
                  <Typography noWrap>{article.title}</Typography>
                </Stack>
                <form action={unhighlightArticle.bind(null, article.id)}>
                  <Button type="submit" size="small" color="inherit">Remove</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Add an article</Typography>
        <Box component="form" method="GET" sx={{ mb: 2 }}>
          <TextField name="q" label="Search published articles by title" defaultValue={q ?? ""} fullWidth size="small" />
        </Box>
        {q && searchResults.length === 0 && (
          <Typography sx={{ color: "text.secondary" }}>No published articles match &ldquo;{q}&rdquo;.</Typography>
        )}
        <Stack spacing={1}>
          {searchResults.map((article) => (
            <Card key={article.id} variant="outlined">
              <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap", "&:last-child": { pb: 2 } }}>
                <Typography sx={{ flex: 1, minWidth: 220 }} noWrap>{article.title}</Typography>
                <Stack direction="row" spacing={1}>
                  {article.featured ? (
                    <Chip label="In hero" size="small" color="primary" />
                  ) : (
                    <form action={featureArticle.bind(null, article.id)}>
                      <Button type="submit" size="small" variant="outlined">Add to hero</Button>
                    </form>
                  )}
                  {article.highlighted ? (
                    <Chip label="Highlighted" size="small" color="warning" />
                  ) : (
                    <form action={highlightArticle.bind(null, article.id)}>
                      <Button type="submit" size="small" variant="outlined" color="warning">Add to highlights</Button>
                    </form>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    </Container>
  );
}
