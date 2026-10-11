/**
 * Fan card rules (pure, unit-tested): streaks from visit days, loyalty tiers,
 * badges, and the bot / day-string checks used by the visit endpoint.
 * The database side lives in fanStore.ts.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

export function isDayString(value: unknown): value is string {
  return typeof value === "string" && DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// The visitor's own local date is the fair day for a streak (a US evening is
// already "tomorrow" in UTC). It is client-supplied, so accept it only within a
// day of the server's UTC date; anything else falls back to the UTC date.
export function resolveVisitDay(clientDay: unknown, now: Date = new Date()): string {
  const today = utcDay(now);
  if (!isDayString(clientDay)) return today;
  return Math.abs(dayNumber(clientDay) - dayNumber(today)) <= 1 ? clientDay : today;
}

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|facebookexternalhit|preview|lighthouse|pagespeed|curl|wget|python-requests|node-fetch/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

export interface Streaks {
  current: number;
  best: number;
}

// `days` = YYYY-MM-DD strings. The current streak is the run of consecutive
// days ending today, or ending yesterday (a visitor who has not come back yet
// today has not lost it).
export function computeStreaks(days: string[], today: string): Streaks {
  const nums = [...new Set(days.filter(isDayString).map(dayNumber))].sort((a, b) => a - b);
  if (nums.length === 0) return { current: 0, best: 0 };
  let best = 1;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  const last = nums[nums.length - 1];
  if (last < dayNumber(today) - 1) return { current: 0, best };
  let current = 1;
  for (let i = nums.length - 1; i > 0 && nums[i] === nums[i - 1] + 1; i--) current++;
  return { current, best };
}

export interface Tier {
  id: "rookie" | "regular" | "season-ticket" | "hall-of-famer";
  label: string;
  minDays: number;
}

export const TIERS: Tier[] = [
  { id: "rookie", label: "Rookie", minDays: 1 },
  { id: "regular", label: "Regular", minDays: 7 },
  { id: "season-ticket", label: "Season Ticket", minDays: 30 },
  { id: "hall-of-famer", label: "Hall of Famer", minDays: 100 },
];

export function tierFor(daysVisited: number): Tier | null {
  let found: Tier | null = null;
  for (const tier of TIERS) if (daysVisited >= tier.minDays) found = tier;
  return found;
}

export function nextTier(daysVisited: number): { tier: Tier; daysToGo: number } | null {
  const next = TIERS.find((t) => daysVisited < t.minDays);
  return next ? { tier: next, daysToGo: next.minDays - daysVisited } : null;
}

export interface FanFacts {
  daysVisited: number;
  bestStreak: number;
  predictionsMade: number;
  predictionsCorrect: number;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
}

// Every badge is earned from facts we store; none can be bought or faked.
export function earnedBadges(f: FanFacts): Badge[] {
  const badges: Badge[] = [];
  const tier = tierFor(f.daysVisited);
  if (tier) badges.push({ id: tier.id, label: tier.label, description: `Visited on ${tier.minDays} different day${tier.minDays === 1 ? "" : "s"}` });
  for (const n of [3, 7, 30]) {
    if (f.bestStreak >= n) badges.push({ id: `streak-${n}`, label: `${n}-day streak`, description: `Came back ${n} days in a row` });
  }
  if (f.predictionsMade >= 1) badges.push({ id: "first-prediction", label: "First Prediction", description: "Made a match prediction" });
  if (f.predictionsCorrect >= 5) badges.push({ id: "sharp-eye", label: "Sharp Eye", description: "Called 5 winners correctly" });
  return badges;
}

// Every badge earnedBadges can return, for the "still to earn" list on the
// fan card. Built by asking earnedBadges about a fan who has everything.
export function badgeCatalog(): Badge[] {
  const all = earnedBadges({ daysVisited: 100, bestStreak: 30, predictionsMade: 1, predictionsCorrect: 5 });
  const tiers = TIERS.map((t) => earnedBadges({ daysVisited: t.minDays, bestStreak: 0, predictionsMade: 0, predictionsCorrect: 0 })[0]);
  const rest = all.filter((b) => !TIERS.some((t) => t.id === b.id));
  return [...tiers, ...rest];
}
