import Box from "@mui/material/Box";

// Initials badge for a club/player/country/sport — tinted with the entity's
// sport color so a row of followed teams reads by sport at a glance. Same
// visual role as playerAvatar.ts's fallback, used where no real crest or
// photo has been fetched (search suggestions, follow lists).
export function EntityAvatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: `${color}1f`,
        color,
        fontWeight: 700,
        fontSize: Math.round(size * 0.36),
        letterSpacing: 0.3,
      }}
    >
      {initials}
    </Box>
  );
}
