import { readSnapshot } from "../snapshots/read";
import { EVENT_HUBS } from "./eventHubs";
import { athleteSlug, type GamesMedal } from "./athletes";
import { medalistsKey, profileKey, type AthleteProfile, type MedalistsSnapshot } from "./athleteStore";

// What the athlete pages show, read from the stored copies the sync keeps
// (athleteSync.ts).

export async function getMedalists(eventKey: string, country: string): Promise<MedalistsSnapshot | null> {
  return readSnapshot<MedalistsSnapshot>(medalistsKey(eventKey, country));
}

export async function getAthleteProfile(slug: string): Promise<AthleteProfile | null> {
  return readSnapshot<AthleteProfile>(profileKey(slug));
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
