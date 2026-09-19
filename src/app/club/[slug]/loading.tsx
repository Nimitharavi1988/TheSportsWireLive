import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

// Matches the real page's shape (title header, list of article cards)
// instead of the generic root spinner.
export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Skeleton width="50%" height={44} sx={{ mb: 3 }} />
      <Stack spacing={2}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Stack key={i} direction="row" spacing={2}>
            <Skeleton variant="rounded" width={84} height={84} sx={{ flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="90%" height={28} />
              <Skeleton width="70%" height={28} />
              <Skeleton width="40%" height={20} />
            </Box>
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}
