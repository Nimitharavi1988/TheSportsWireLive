"use client";

import { useEffect } from "react";
import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container maxWidth="sm" sx={{ py: 10, textAlign: "center" }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h5" component="h1">
          Something went wrong
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This page hit an unexpected error. You can try again, or head back home.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button onClick={() => reset()} variant="contained">
            Try again
          </Button>
          <Button component={Link} href="/" variant="outlined">
            Back to Sports News
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
