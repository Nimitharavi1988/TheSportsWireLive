// Spanish page chrome (nav, labels, notices). Neutral Spanish for US Hispanic,
// Latin American and Spanish readers (PLAN.md). Article text itself comes from
// ArticleTranslation; this is only the fixed UI strings. A second language gets
// its own file with the same shape.

export const ES = {
  siteName: "Sports Wire Live",
  htmlLang: "es",
  tagline: "Noticias deportivas, resultados y análisis, actualizados las 24 horas.",
  metaTitle: "Sports Wire Live en Español — Noticias de Fútbol, NBA, MLB y F1",
  metaDescription:
    "Últimas noticias de fútbol, baloncesto, béisbol, fútbol americano y Fórmula 1: resultados, fichajes y crónicas en español, actualizadas las 24 horas.",
  nav: { home: "Inicio", english: "English" },
  searchPlaceholder: "Buscar noticias",
  searchButton: "Buscar",
  home: { latest: "Últimas noticias", topStory: "Noticia destacada", bySport: "Por deporte", empty: "Todavía no hay noticias en español. Vuelve pronto." },
  article: {
    published: "Publicado",
    machineTranslated: "Traducido automáticamente del inglés.",
    readOriginal: "Leer el original en inglés",
    reportIssue: "¿Un error en la traducción? Avísanos",
    originalSource: "Fuente original",
    related: "Más en",
    share: "Compartir",
  },
  section: { moreIn: "Más noticias de", empty: "No hay noticias en español para este deporte por ahora." },
  search: { title: "Buscar", results: "Resultados para", none: "No encontramos resultados para", prompt: "Escribe lo que quieres buscar." },
  footer: {
    rights: "Todos los derechos reservados.",
    about: "Acerca de",
    contact: "Contacto",
    privacy: "Política de privacidad",
    terms: "Términos del servicio",
    englishNote: "Estas páginas están disponibles en inglés.",
  },
  notFound: { title: "Página no encontrada", body: "La página que buscas no existe o la noticia fue retirada.", back: "Volver al inicio" },
  error: { title: "Algo salió mal", body: "Esta página tuvo un error inesperado.", retry: "Intentar de nuevo" },
} as const;

// Sports shown on the Spanish site, in nav order (keys are Article.category).
export const ES_SPORTS: { category: string; label: string }[] = [
  { category: "football", label: "Fútbol" },
  { category: "basketball", label: "NBA" },
  { category: "baseball", label: "MLB" },
  { category: "american-football", label: "NFL" },
  { category: "formula-1", label: "Fórmula 1" },
  { category: "athletics", label: "Atletismo" },
];

const ES_CATEGORY_LABELS: Record<string, string> = {
  football: "Fútbol",
  "football/world-cup": "Mundial",
  basketball: "NBA",
  baseball: "MLB",
  "american-football": "NFL",
  "formula-1": "Fórmula 1",
  athletics: "Atletismo",
};

export function categoryLabelEs(category: string): string {
  return ES_CATEGORY_LABELS[category] ?? category;
}

export function formatDateEs(d: Date, withYear = false): string {
  return d.toLocaleDateString("es-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
}
