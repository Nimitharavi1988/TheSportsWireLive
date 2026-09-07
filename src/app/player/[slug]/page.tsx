import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { TRACKED_PLAYERS } from "@/lib/players";
import { fetchPersonPhoto } from "@/lib/ingestion/wikimediaImages";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";

// The player's photo rarely changes day to day — an hour of staleness is a
// fine trade for not hitting the Wikimedia API on every single page view.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = TRACKED_PLAYERS.find((p) => p.slug === slug);
  if (!player) return {};
  return {
    title: `${player.name} News`,
    description: `Latest news and coverage of ${player.name}.`,
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = TRACKED_PLAYERS.find((p) => p.slug === slug);
  if (!player) notFound();

  const [photo, articles] = await Promise.all([
    fetchPersonPhoto(player.name),
    db.article.findMany({
      where: {
        status: "published",
        OR: player.searchTerms.map((term) => ({ title: { contains: term, mode: "insensitive" as const } })),
      },
      orderBy: { publishedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" spacing={3} sx={{ alignItems: "center", mb: 4 }}>
        {photo && (
          <Box
            component="img"
            src={photo.url}
            alt={player.name}
            sx={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", objectPosition: "top", flexShrink: 0 }}
          />
        )}
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {player.name}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {articles.length} {articles.length === 1 ? "story" : "stories"} on Sports Wire Live
          </Typography>
        </Box>
      </Stack>

      {photo?.credit && (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 3 }}>
          <a href={photo.creditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
            {photo.credit}
          </a>
        </Typography>
      )}

      {articles.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
          No stories about {player.name} yet — check back soon.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {articles.map((article) => (
            <Card key={article.id} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                  <Chip label={article.sourceName} size="small" variant="outlined" sx={{ color: "primary" }} />
                  {article.publishedAt && (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {article.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Typography>
                  )}
                </Stack>
                <Typography variant="h6" component="h2" gutterBottom>
                  <Link href={`/article/${article.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {article.title}
                  </Link>
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {article.summary}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
