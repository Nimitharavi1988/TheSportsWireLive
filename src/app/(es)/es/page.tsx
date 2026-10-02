import type { Metadata } from "next";
import { HomeView } from "@/app/(en)/_home/HomeView";
import { ES } from "@/lib/i18n/es";

// ISR: rendered once, served from cache, refreshed in the background.
export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: ES.metaTitle },
  description: ES.metaDescription,
  alternates: {
    canonical: "/",
    languages: { es: "/", en: process.env.SITE_URL ?? "https://sportswirelive.com" },
  },
};

// The Spanish home is the English home with the Spanish edition's dictionary and
// translated articles — same sections, same design (see HomeView's `locale`).
export default function SpanishHome() {
  return <HomeView locale="es" />;
}
