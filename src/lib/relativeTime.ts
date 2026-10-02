import { getDict } from "@/lib/i18n/dictionary";

// "2h ago" / "3d ago" style — distinct from the "Sep 6" date chips used
// elsewhere, for freshness-signal modules like "Just In". locale picks the
// language (default English).
export function relativeTime(date: Date, locale?: string): string {
  const t = getDict(locale).time;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t.hours(hours);
  const days = Math.round(hours / 24);
  return t.days(days);
}
