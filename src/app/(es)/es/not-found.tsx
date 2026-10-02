import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { ES } from "@/lib/i18n/es";

export default function NotFoundEs() {
  return (
    <Container maxWidth="sm" sx={{ py: 10, textAlign: "center" }}>
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="h2" component="p" sx={{ fontWeight: 700 }}>404</Typography>
        <Typography variant="h5" component="h1">{ES.notFound.title}</Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>{ES.notFound.body}</Typography>
        <Button href="/" variant="contained" sx={{ mt: 2 }}>{ES.notFound.back}</Button>
      </Stack>
    </Container>
  );
}
