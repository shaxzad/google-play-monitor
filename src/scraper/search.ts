import { search as googlePlaySearch } from "@mradex77/google-play-scraper";

export interface SearchResult {
  appId?: string;
  title?: string;
  developer?: string;
  score?: number;
  icon?: string;
  url?: string;
}

export async function searchApps(
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("Search query cannot be empty");
  }

  const results = await googlePlaySearch({
    term: normalizedQuery,
    num: limit,
    lang: process.env.GOOGLE_PLAY_LANGUAGE || "en",
    country: process.env.GOOGLE_PLAY_COUNTRY || "us",
  });

  return results.map((item: unknown) => {
    const result = item as Record<string, unknown>;

    return {
      appId: typeof result.appId === "string" ? result.appId : undefined,

      title: typeof result.title === "string" ? result.title : undefined,

      developer:
        typeof result.developer === "string" ? result.developer : undefined,

      score: typeof result.score === "number" ? result.score : undefined,

      icon: typeof result.icon === "string" ? result.icon : undefined,

      url: typeof result.url === "string" ? result.url : undefined,
    };
  });
}
