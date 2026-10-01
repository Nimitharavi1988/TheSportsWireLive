"use client";

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";

// Tabs left to right with an underline on the active one — an innings per
// tab on a cricket scorecard, a team per tab on a box score. Same tab style
// as the day tabs on /scores. Each tab's content is built on the server;
// only the chosen one is mounted. A second line (`sub`) carries the score.
export interface UnderlineTab {
  key: string;
  label: string;
  sub?: string;
  node: ReactNode;
}

export function UnderlineTabs({ tabs, initialKey, label }: { tabs: UnderlineTab[]; initialKey?: string; label: string }) {
  const [active, setActive] = useState(initialKey ?? tabs[0]?.key);
  if (tabs.length === 0) return null;
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <Box>
      <Box role="tablist" aria-label={label} sx={{ display: "flex", overflowX: "auto", overflowY: "hidden", borderBottom: "1px solid", borderColor: "divider", mb: 1.5 }}>
        {tabs.map((t) => {
          const on = t.key === current.key;
          return (
            <Box
              key={t.key}
              component="button"
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={on}
              onClick={() => setActive(t.key)}
              sx={{
                flex: { sm: "0 0 auto" },
                minWidth: 120,
                px: 2,
                py: 1,
                border: 0,
                bgcolor: "transparent",
                font: "inherit",
                textAlign: "left",
                cursor: "pointer",
                whiteSpace: "nowrap",
                color: on ? "text.primary" : "text.secondary",
                borderBottom: "3px solid",
                borderColor: on ? "primary.main" : "transparent",
                mb: "-1px",
                "&:hover": { color: "text.primary", bgcolor: "action.hover" },
              }}
            >
              <Box component="div" sx={{ fontSize: 13, fontWeight: on ? 700 : 500 }}>{t.label}</Box>
              {t.sub && <Box component="div" sx={{ fontSize: 12, fontVariantNumeric: "tabular-nums", fontWeight: on ? 700 : 400 }}>{t.sub}</Box>}
            </Box>
          );
        })}
      </Box>
      <Box role="tabpanel" aria-labelledby={`tab-${current.key}`}>{current.node}</Box>
    </Box>
  );
}
