"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import type { EntityResult } from "@/lib/entitySearch";
import { followKey, serializeFollows } from "@/lib/follows";
import { EntityAvatar } from "./EntityAvatar";
import { FollowButton } from "./FollowButton";
import { useFollows } from "./useFollows";
import { entitiesSeenInSuggestions, useSuggest } from "./useSuggest";

// Top of /for-you: what you follow (removable chips) and a "Follow more"
// picker with search + popular suggestions — the onboarding screen The
// Athletic/FotMob show, but inline and reopenable instead of a one-time
// modal. The page itself is server-rendered from the cookie, so any change
// here just refreshes it.
export function FollowManager({ initialEntities }: { initialEntities: EntityResult[] }) {
  const router = useRouter();
  const { follows, ready, toggle } = useFollows();
  const [pickerOpen, setPickerOpen] = useState(initialEntities.length === 0);
  const [query, setQuery] = useState("");
  const { data } = useSuggest(query, pickerOpen);

  // Names for chips: everything the server resolved, plus anything the
  // picker has shown (so a newly followed team is labeled before the
  // refresh lands). Recomputed each render; the lists are small.
  const known = new Map([...entitiesSeenInSuggestions(), ...initialEntities].map((e) => [followKey(e), e]));

  // Refresh the server-rendered feed after follows change (debounced so
  // several quick follows in the picker cause one refresh, not five).
  const serialized = serializeFollows(follows);
  const lastSerialized = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (lastSerialized.current === null) {
      lastSerialized.current = serialized;
      return;
    }
    if (lastSerialized.current === serialized) return;
    lastSerialized.current = serialized;
    const timer = setTimeout(() => router.refresh(), 400);
    return () => clearTimeout(timer);
  }, [serialized, ready, router]);

  const followed = (ready ? follows : initialEntities)
    .map((ref) => known.get(followKey(ref)))
    .filter((e): e is EntityResult => Boolean(e));

  const suggestions = query.trim().length >= 2 ? data?.entities ?? [] : data?.popular ?? [];

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: pickerOpen ? 2 : 0 }}>
        {followed.map((e) => (
          <Box
            key={followKey(e)}
            sx={{ display: "flex", alignItems: "center", gap: 0.75, pl: 0.5, pr: 0.25, py: 0.25, borderRadius: 5, border: "1px solid", borderColor: "divider" }}
          >
            <EntityAvatar initials={e.initials} color={e.color} size={26} />
            <Typography component={Link} href={e.href} sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", textDecoration: "none", "&:hover": { color: "primary.main" } }}>
              {e.name}
            </Typography>
            <IconButton size="small" aria-label={`Unfollow ${e.name}`} onClick={() => toggle({ kind: e.kind, slug: e.slug })}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        ))}
        <Button
          size="small"
          variant={pickerOpen ? "text" : "outlined"}
          startIcon={pickerOpen ? undefined : <AddIcon />}
          onClick={() => setPickerOpen((o) => !o)}
          sx={{ borderRadius: 5, textTransform: "none", fontWeight: 600 }}
        >
          {pickerOpen ? (followed.length > 0 ? "Done" : "Hide") : followed.length > 0 ? "Follow more" : "Follow teams and players"}
        </Button>
      </Box>

      {pickerOpen && (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, height: 44, borderRadius: 5, bgcolor: "action.hover", mb: 1.5 }}>
            <SearchIcon sx={{ fontSize: 20, color: "text.secondary" }} />
            <InputBase
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a team, player, country or sport"
              sx={{ flex: 1, fontSize: 15 }}
              inputProps={{ "aria-label": "Find something to follow" }}
            />
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mb: 0.5 }}>
            {query.trim().length >= 2 ? "Results" : "Popular"}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 2 }}>
            {suggestions.map((e) => (
              <Box key={followKey(e)} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.75 }}>
                <EntityAvatar initials={e.initials} color={e.color} size={32} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>{e.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }} noWrap>{e.subtitle}</Typography>
                </Box>
                <FollowButton kind={e.kind} slug={e.slug} name={e.name} />
              </Box>
            ))}
          </Box>
          {query.trim().length >= 2 && data && suggestions.length === 0 && (
            <Typography sx={{ fontSize: 14, color: "text.secondary", py: 1 }}>
              Nothing to follow matches &ldquo;{query.trim()}&rdquo; yet.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
