import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

// Matches the real page's shape (circular photo + name header, list of
// story cards) instead of the generic root spinner.
export default function Loading() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Skeleton width={180} height={24} sx={{ mb: 2 }} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 300px" }, gap: 4 }}>
        <Box>
          <Stack direction="row" spacing={3} sx={{ alignItems: "center", mb: 4 }}>
            <Skeleton variant="circular" width={120} height={120} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="60%" height={44} />
              <Skeleton width="40%" height={24} />
            </Box>
          </Stack>
          <Stack spacing={2}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Stack key={i} direction="row" spacing={2}>
                <Skeleton variant="rounded" width={64} height={64} sx={{ flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="90%" height={24} />
                  <Skeleton width="70%" height={24} />
                </Box>
              </Stack>
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
