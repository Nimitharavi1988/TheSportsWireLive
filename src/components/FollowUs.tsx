import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FacebookIcon from "@mui/icons-material/Facebook";

// One entry per platform the Page is actually live on — add Instagram/X
// here the same way once they're wired up (each just needs a url, Icon,
// and hover color), no layout changes needed elsewhere in this component.
const SOCIAL_LINKS: { name: string; url: string; Icon: typeof FacebookIcon; color: string }[] = [
  { name: "Facebook", url: "https://www.facebook.com/SportsWireLiveNews", Icon: FacebookIcon, color: "#1877F2" },
];

// Article-page traffic converts to page views far more than it converts to
// Page follows — a reader who liked one story has no reason to come back
// unless asked. Placed right after the engagement module (same reasoning
// as that component's own placement: before the reader clicks through to
// the outbound source and leaves).
//
// Same IconButton + Tooltip pattern as ShareButtons.tsx, but on a light
// brand-tinted pill rather than a plain borderTop line — the plain version
// read as too easy to miss entirely; this keeps the single-row, no-wrap
// discipline while actually catching the eye. Each platform icon shows in
// its own brand color by default (not just on hover) for the same reason.
export function FollowUs() {
  return (
    <Box
      sx={{
        mt: 3,
        p: 1.75,
        borderRadius: 2,
        bgcolor: "rgba(29, 107, 63, 0.06)",
        border: "1px solid",
        borderColor: "rgba(29, 107, 63, 0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 600 }}>
        Follow us for live scores &amp; news
      </Typography>
      <Stack direction="row" spacing={0.5}>
        {SOCIAL_LINKS.map(({ name, url, Icon, color }) => (
          <Tooltip key={name} title={`Follow on ${name}`}>
            <IconButton
              component="a"
              href={url}
              target="_blank"
              rel="noreferrer"
              size="small"
              sx={{ color, bgcolor: "background.paper", "&:hover": { bgcolor: "background.paper", opacity: 0.8 } }}
            >
              <Icon fontSize="small" />
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
}
