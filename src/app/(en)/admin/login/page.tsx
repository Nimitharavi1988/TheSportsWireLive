"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
    }
  }

  return (
    <Container maxWidth="xs" sx={{ mt: { xs: 6, sm: 12 } }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Admin login
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large">
              Log in
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
