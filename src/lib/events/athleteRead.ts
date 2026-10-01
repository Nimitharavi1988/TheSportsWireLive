import { readSnapshot } from "../snapshots/read";
import { EVENT_HUBS } from "./eventHubs";
import { athleteSlug, type GamesMedal } from "./athletes";
import { athleteSlugsOf, medalistsKey, profileKey, type AthleteProfile, type MedalistsSnapshot } from "./athleteStore";

// What the athlete pages show, read from the stored copies the sync keeps
// (athleteSync.ts).

export async function getMedalists(eventKey: string, country: string): Promise<MedalistsSnapshot | null> {
  return readSnapshot<MedalistsSnapshot>(medalistsKey(eventKey, country));
}

export async function getAthleteProfile(slug: string): Promise<AthleteProfile | null> {
  return readSnapshot<AthleteProfile>(profileKey(slug));
}

// Slugs of every athlete page that exists (for the sitemap), across all the
// Games with a stored medallists list.
export async function listAthleteSlugs(): Promise<string[]> {
  const slugs = new Set<string>();
  for (const hub of Object.values(EVENT_HUBS)) {
    if (!hub.athletes) continue;
    const list = await getMedalists(hub.eventKey, hub.athletes.country);
    if (list) for (const s of athleteSlugsOf(list)) slugs.add(s);
  }
  return [...slugs];
}

// Names of the athletes with a page, in one sport, as { name, href } — for
// linking names elsewhere (the cricket scorecard). Sport as the medallists list
// writes it ("Cricket"), so a shooter can't match a cricketer of the same name.
export async function listAthleteNames(sport: string): Promise<{ name: string; href: string }[]> {
  const out: { name: string; href: string }[] = [];
  for (const hub of Object.values(EVENT_HUBS)) {
    if (!hub.athletes) continue;
    const list = await getMedalists(hub.eventKey, hub.athletes.country);
    for (const m of list?.medals ?? []) {
      if (m.sport.toLowerCase() !== sport.toLowerCase()) continue;
      for (const a of m.athletes) if (a.title) out.push({ name: a.name, href: `/athlete/${athleteSlug(a.title)}` });
    }
  }
  return out;
}

export interface AthleteAtGames {
  slug: string;
  name: string;
  title: string;
  eventKey: string;
  country: string;
  // Every medal this athlete is part of at the Games.
  medals: GamesMedal[];
}

// The athlete with this slug among the Games' medallists, or null — an athlete
// page exists only for someone on a stored list, whatever else is in the URL.
export async function findAthlete(slug: string): Promise<AthleteAtGames | null> {
  for (const hub of Object.values(EVENT_HUBS)) {
    if (!hub.athletes) continue;
    const list = await getMedalists(hub.eventKey, hub.athletes.country);
    if (!list) continue;
    const medals = list.medals.filter((m) => m.athletes.some((a) => a.title && athleteSlug(a.title) === slug));
    if (medals.length === 0) continue;
    const athlete = medals[0].athletes.find((a) => a.title && athleteSlug(a.title) === slug)!;
    return { slug, name: athlete.name, title: athlete.title!, eventKey: hub.eventKey, country: list.country, medals };
  }
  return null;
}
