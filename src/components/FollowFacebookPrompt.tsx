import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FacebookIcon from "@mui/icons-material/Facebook";

const FACEBOOK_PAGE_URL = "https://www.facebook.com/SportsWireLiveNews";

// Article-page traffic converts to page views far more than it converts to
// Page follows — a reader who liked one story has no reason to come back
// unless asked. Placed right after the engagement module (same reasoning
// as that component's own placement: before the reader clicks through to
// the outbound source and leaves), a plain, low-key prompt rather than an
// interrupting popup/modal, matching the site's simple/light design
// direction throughout.
export function FollowFacebookPrompt() {
  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 3,
        p: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1.5,
        bgcolor: "rgba(29, 107, 63, 0.04)",
        borderColor: "rgba(29, 107, 63, 0.2)",
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <FacebookIcon sx={{ color: "#1877F2", fontSize: 28 }} />
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Enjoying the coverage?</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Follow Sports Wire Live on Facebook for scores and news as they happen.
          </Typography>
        </Box>
      </Stack>
      <Button
        component="a"
        href={FACEBOOK_PAGE_URL}
        target="_blank"
        rel="noreferrer"
        variant="contained"
        size="small"
        startIcon={<FacebookIcon />}
        sx={{ bgcolor: "#1877F2", flexShrink: 0, "&:hover": { bgcolor: "#145dbf" } }}
      >
        Follow
      </Button>
    </Paper>
  );
}
