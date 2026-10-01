"use client";

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";

// Tabs over several sports' standings cards. Each tab's card is built on the
// server (so the data is already there); only the chosen one is mounted.
export function SportTabs({ tabs }: { tabs: { key: string; label: string; node: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  if (tabs.length === 0) return null;
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <Box>
      {tabs.length > 1 && (
        <Box role="tablist" aria-label="Standings by sport" sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1 }}>
          {tabs.map((t) => {
            const on = t.key === current.key;
            return (
              <Box
                key={t.key}
                component="button"
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.key)}
                sx={{
                  px: 1.5, py: 0.4, borderRadius: 5, font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: "1px solid", borderColor: on ? "text.primary" : "divider",
                  bgcolor: on ? "text.primary" : "transparent", color: on ? "background.paper" : "text.secondary",
                  "&:hover": on ? {} : { borderColor: "text.secondary", color: "text.primary" },
                }}
              >
                {t.label}
              </Box>
            );
          })}
        </Box>
      )}
      {current.node}
    </Box>
  );
}
