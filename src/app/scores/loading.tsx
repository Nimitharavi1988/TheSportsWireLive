import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

// Matches the real page's shape (sport filter chips, then two stacked
// match-row lists) instead of the generic root spinner.
export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Skeleton width={260} height={40} sx={{ mb: 1 }} />
      <Skeleton width="60%" height={24} sx={{ mb: 3 }} />
      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: "wrap" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={90} height={32} sx={{ borderRadius: 4 }} />
        ))}
      </Stack>
      <Skeleton width={180} height={28} sx={{ mb: 1.5 }} />
      <Stack spacing={1} sx={{ mb: 4 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>
      <Skeleton width={180} height={28} sx={{ mb: 1.5 }} />
      <Stack spacing={1}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>
    </Container>
  );
}
