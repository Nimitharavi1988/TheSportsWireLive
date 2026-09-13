import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

// Matches the real page's rough shape (breadcrumb, hero image, title, body
// paragraphs) instead of the generic root spinner — this is where most real
// traffic actually lands (search, social shares), so the loading state is
// worth a route-specific skeleton rather than a blank/spinner interstitial.
export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Skeleton width={220} height={24} sx={{ mb: 2 }} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 300px", lg: "220px 1fr 300px" }, gap: 4 }}>
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <Skeleton variant="rounded" height={200} />
        </Box>
        <Box>
          <Skeleton variant="rounded" height={400} sx={{ mb: 2.5, borderRadius: 1.5 }} />
          <Skeleton width={90} height={28} sx={{ mb: 1.5, borderRadius: 2 }} />
          <Skeleton width="90%" height={40} />
          <Skeleton width="60%" height={40} sx={{ mb: 2 }} />
          <Skeleton width={200} height={20} sx={{ mb: 3 }} />
          <Stack spacing={1.25}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} width={i % 3 === 2 ? "70%" : "100%"} height={20} />
            ))}
          </Stack>
        </Box>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <Skeleton variant="rounded" height={280} />
        </Box>
      </Box>
    </Container>
  );
}
