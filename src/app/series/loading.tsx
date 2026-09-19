import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

// Matches the real page's shape (title header, grid of series tiles)
// instead of the generic root spinner.
export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Skeleton width={260} height={44} sx={{ mb: 3 }} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={90} />
        ))}
      </Box>
    </Container>
  );
}
