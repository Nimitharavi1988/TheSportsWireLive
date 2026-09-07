// Shared initials-avatar fallback for player images — used wherever a real
// Wikimedia photo isn't available (missing from Commons, lookup failed, no
// free-licensed image found) so a player is never rendered as a bare name
// with no visual anchor at all. Colors are a small, deliberately muted
// 3-color rotation (brand green plus two restrained neutrals) rather than a
// wide palette, so a row of several avatars still reads as one cohesive set.
export const PLAYER_AVATAR_COLORS = ["#1d6b3f", "#b8752e", "#3d5a73"];

export function playerInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function playerAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PLAYER_AVATAR_COLORS[Math.abs(hash) % PLAYER_AVATAR_COLORS.length];
}
