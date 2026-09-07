import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

export default function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: 10, textAlign: "center" }}>
      <Stack spacing={2} sx={{
        alignItems: "center"
      }}>
        <Typography variant="h2" component="p" sx={{
          fontWeight: 700
        }}>
          404
        </Typography>
        <Typography variant="h5" component="h1">
          Page not found
        </Typography>
        <Typography variant="body1" sx={{
          color: "text.secondary"
        }}>
          The page you're looking for doesn't exist, or the article may have been removed.
        </Typography>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Button variant="contained" sx={{ mt: 2 }}>
            Back to Sports Wire Live
          </Button>
        </Link>
      </Stack>
    </Container>
  );
}
