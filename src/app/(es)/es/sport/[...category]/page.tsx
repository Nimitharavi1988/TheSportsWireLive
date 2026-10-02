import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeView } from "@/app/(en)/_home/HomeView";
import { ES, categoryLabelEs } from "@/lib/i18n/es";
import { LOCALES } from "@/lib/i18n/locales";

export const revalidate = 60;
export async function generateStaticParams() {
  return [];
}

// Only sports the Spanish edition covers; anything else 404s (the middleware
// has no English fallback for /sport/<other> — that sport simply isn't here).
function resolveCategory(parts: string[]): string | null {
  const category = parts.join("/");
  const allowed = new Set([...ES.sports.map((s) => s.category), ...LOCALES.es.categories]);
  return allowed.has(category) ? category : null;
}

export async function generateMetadata(props: { params: Promise<{ category: string[] }> }): Promise<Metadata> {
  const category = resolveCategory((await props.params).category);
  if (!category) return {};
  const label = categoryLabelEs(category);
  const en = process.env.SITE_URL ?? "https://sportswirelive.com";
  return {
    title: `Noticias de ${label}`,
    description: `Últimas noticias de ${label}: resultados, crónicas y análisis en español, actualizados las 24 horas.`,
    alternates: { canonical: `/sport/${category}`, languages: { es: `/sport/${category}`, en: `${en}/sport/${category}` } },
  };
}

// The English sport section, in Spanish: same sections and design.
export default async function SpanishSportPage(props: { params: Promise<{ category: string[] }> }) {
  const category = resolveCategory((await props.params).category);
  if (!category) notFound();
  return <HomeView category={category} locale="es" />;
}
