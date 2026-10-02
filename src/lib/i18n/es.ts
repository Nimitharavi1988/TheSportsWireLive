import type { Dict } from "./dictionary";
import { categoryLabel, formatShortDate } from "./helpers";

// Spanish dictionary: neutral Spanish for US Hispanic, Latin American and
// Spanish readers (PLAN.md). Article text itself comes from ArticleTranslation;
// this is only the fixed UI strings.
export const ES: Dict = {
  htmlLang: "es",
  ogLocale: "es_US",
  dateLocale: "es-US",
  siteName: "Sports Wire Live",
  tagline: "Noticias deportivas, resultados y análisis, actualizados las 24 horas.",
  metaTitle: "Sports Wire Live en Español — Noticias de Fútbol, NBA, MLB y F1",
  metaDescription:
    "Últimas noticias de fútbol, baloncesto, béisbol, fútbol americano y Fórmula 1: resultados, fichajes y crónicas en español, actualizadas las 24 horas.",
  otherSiteLabel: "English",
  nav: { home: "Inicio", searchPlaceholder: "Buscar noticias", searchButton: "Buscar", sections: "Secciones", moreSports: "Más deportes", openMenu: "Abrir menú", pages: {} },
  sports: [
    { category: "football", label: "Fútbol" },
    { category: "basketball", label: "NBA" },
    { category: "baseball", label: "MLB" },
    { category: "american-football", label: "NFL" },
    { category: "formula-1", label: "Fórmula 1" },
    { category: "athletics", label: "Atletismo" },
  ],
  categoryLabels: {
    football: "Fútbol",
    "football/world-cup": "Mundial",
    basketball: "NBA",
    baseball: "MLB",
    "american-football": "NFL",
    "formula-1": "Fórmula 1",
    athletics: "Atletismo",
  },
  time: {
    justNow: "ahora mismo",
    minutes: (n) => `hace ${n} min`,
    hours: (n) => `hace ${n} h`,
    days: (n) => `hace ${n} d`,
  },
  home: {
    topStory: "Noticia destacada",
    justIn: "Última hora",
    byCategory: "Por deporte",
    byCompetition: "Por competición",
    transfers: "Fichajes y noticias destacadas",
    matchResults: "Resultados y previas",
    nflScores: "NFL: resultados y previas",
    playerNews: "Noticias de jugadores",
    alsoInNews: "También en las noticias",
    alsoInNewsCaption: "Enlaces rápidos a la cobertura de toda la web: abre cada uno para leer la historia completa.",
    moreHeadlines: "Más titulares",
    editorsPick: "📌 Selección de la redacción",
    latest: "Últimas noticias",
    bySport: "Por deporte",
    empty: "Todavía no hay noticias en español. Vuelve pronto.",
    emptyCategory: "No hay noticias en español para este deporte por ahora.",
    emptyAdmin: "Todavía no hay noticias en español. Vuelve pronto.",
    noWorldCup: "Por ahora no hay cobertura del Mundial",
    noWorldCupHint: "El torneo se juega cada cuatro años. Vuelve más cerca del próximo o mira lo que pasa ahora en Fútbol.",
  },
  hero: {
    topStory: "Noticia destacada",
    previous: "Noticia destacada anterior",
    next: "Siguiente noticia destacada",
    goTo: (i, n) => `Ir a la noticia ${i} de ${n}`,
  },
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
};

// Back-compat helpers for the first Spanish pages (to be replaced by the shared
// components); they just read the dictionary above.
export const ES_SPORTS = ES.sports;
export const categoryLabelEs = (category: string) => categoryLabel(category, ES);
export const formatDateEs = (d: Date, withYear = false) => formatShortDate(d, ES, withYear);
