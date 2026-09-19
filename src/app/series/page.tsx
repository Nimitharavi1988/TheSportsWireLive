import Link from "next/link";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, isNotNull, count, max, desc } from "drizzle-orm";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export const revalidate = 300;
export const metadata = { title: "Cricket Series", alternates: { canonical: "/series" } };

export default async function SeriesIndexPage() {
  // Only series with at least one published story are worth listing — a
  // series article can exist with only pending_review coverage for a while
  // right after ingestion.
  const rows = await db
    .select({
      seriesKey: article.seriesKey,
      seriesLabel: article.seriesLabel,
      count: count(),
      maxPublishedAt: max(article.publishedAt),
    })
    .from(article)
    .where(and(isNotNull(article.seriesKey), eq(article.status, "published")))
    .groupBy(article.seriesKey, article.seriesLabel)
    .orderBy(desc(max(article.publishedAt)));

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Cricket Series
      </Typography>
      <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
        Browse coverage grouped by international series.
      </Typography>

      {rows.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
          No active series right now — check back once one starts.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {rows.map((row) => (
            <Link key={row.seriesKey} href={`/series/${row.seriesKey}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  transition: "border-color 0.15s, background-color 0.15s",
                  "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(29, 107, 63, 0.08)",
                  }}
                >
                  <SportsCricketIcon sx={{ color: "primary.main", fontSize: 20 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6" noWrap>
                    {row.seriesLabel}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {row.count} {row.count === 1 ? "story" : "stories"}
                  </Typography>
                </Box>
                <ChevronRightIcon sx={{ color: "text.secondary" }} />
              </Paper>
            </Link>
          ))}
        </Stack>
      )}
    </Container>
  );
}
