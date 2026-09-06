/**
 * Generic stock photography from Pexels, for articles that have no real
 * image of their own (RSS-sourced news has no crest/photo). Fetches a small
 * pool per category once per ingestion run rather than once per article, to
 * stay well within Pexels' free-tier rate limits (200 req/hr, 20k/month).
 *
 * Docs: https://www.pexels.com/api/documentation/
 * Free tier: attribution required — "Photo by {photographer} on Pexels",
 * linking to the photographer's profile.
 */

export interface StockImage {
  url: string;
  credit: string;
  creditUrl: string;
}

const CATEGORY_QUERIES: Record<string, string> = {
  football: "football stadium",
  cricket: "cricket stadium",
};

async function searchPexels(apiKey: string, query: string, count: number): Promise<StockImage[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}`,
    { headers: { Authorization: apiKey } }
  );

  if (!res.ok) {
    console.error(`Pexels fetch failed for "${query}": ${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data.photos ?? []).map((photo: any) => ({
    url: photo.src?.large ?? photo.src?.medium,
    credit: `Photo by ${photo.photographer} on Pexels`,
    creditUrl: photo.photographer_url,
  }));
}

export async function fetchStockImagePools(): Promise<Record<string, StockImage[]>> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("PEXELS_API_KEY not set — skipping stock image assignment");
    return {};
  }

  const pools: Record<string, StockImage[]> = {};
  for (const [category, query] of Object.entries(CATEGORY_QUERIES)) {
    pools[category] = await searchPexels(apiKey, query, 10);
  }
  return pools;
}

export function pickStockImage(
  pools: Record<string, StockImage[]>,
  category: string
): StockImage | null {
  const key = Object.keys(pools).find((k) => category.startsWith(k));
  const pool = key ? pools[key] : null;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Single-image lookup for render-time use (e.g. the homepage hero banner),
 * as opposed to fetchStockImagePools' bulk per-category pool used during
 * ingestion. Safe to call from a page with `revalidate` set — it only
 * actually hits Pexels once per revalidation window, not per request.
 */
export async function fetchOneStockImage(category: string): Promise<StockImage | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const key = Object.keys(CATEGORY_QUERIES).find((k) => category.startsWith(k));
  const query = key ? CATEGORY_QUERIES[key] : "sports stadium";
  const results = await searchPexels(apiKey, query, 1);
  return results[0] ?? null;
}
