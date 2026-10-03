import Link from "next/link";
import { TRACKED_PLAYERS } from "@/lib/players";
import { playerInitials, playerAvatarColor } from "@/lib/playerAvatar";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { getDict } from "@/lib/i18n/dictionary";
import { categoryLabel } from "@/lib/i18n/helpers";
import { inEdition } from "@/lib/i18n/overlay";

export function playerIndexMetadata(locale?: string) {
  return { title: getDict(locale).entity.players, alternates: { canonical: "/player" } };
}

// Every one of these ~80 pages was previously only reachable via the
// sitemap or incidental article-title tagging — no on-site link existed to
// browse them at all. Same pattern as /standings' own index page. Grouped
// by sport (matching TrackedPlayer.sport) rather than one flat list, since
// football/cricket/NFL fans are looking for different things here.
const SPORT_LABELS: Record<string, string> = {
  football: "Football",
  cricket: "Cricket",
  "american-football": "NFL",
};

// The players index for English or a language edition (its sports only).
export function PlayerIndexView({ locale }: { locale?: string }) {
  const t = getDict(locale);
  const bySport = new Map<string, typeof TRACKED_PLAYERS>();
  for (const player of TRACKED_PLAYERS) {
    if (!inEdition(player.sport, locale)) continue;
    const list = bySport.get(player.sport) ?? [];
    list.push(player);
    bySport.set(player.sport, list);
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t.entity.players}
      </Typography>
      <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
        {t.entity.playersSubtitle}
      </Typography>

      {[...bySport.entries()].map(([sport, players]) => (
        <Box component="section" key={sport} sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1.5, color: categoryChipStyle(sport).color }}>
            {locale ? categoryLabel(sport, t) : (SPORT_LABELS[sport] ?? sport)}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" },
              gap: 1.25,
            }}
          >
            {players.map((player) => (
              <Link key={player.slug} href={`/player/${player.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    transition: "border-color 0.15s, background-color 0.15s",
                    "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: playerAvatarColor(player.name),
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {playerInitials(player.name)}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                    {player.name}
                  </Typography>
                </Paper>
              </Link>
            ))}
          </Box>
        </Box>
      ))}
    </Container>
  );
}
