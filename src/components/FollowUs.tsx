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
// Mirrors ShareButtons.tsx's icon-row treatment exactly (same IconButton +
// Tooltip pattern, same borderTop line as the "Original source" line right
// below it) rather than a standalone tinted card — reads as part of the
// page instead of an ad banner, stays a single row at any width since
// icon buttons don't wrap, and scales to more platforms without redesign.
export function FollowUs() {
  return (
    <Box
      sx={{
        mt: 3,
        pt: 2,
        borderTop: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
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
              sx={{ color: "text.secondary", "&:hover": { color } }}
            >
              <Icon fontSize="small" />
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
}
