import gplay from "@mradex77/google-play-scraper";

export interface SearchResult {
  appId: string;
  title: string;
  developer: string;
  icon?: string;
  score?: number;
  url?: string;
  description?: string;
}

export interface SearchOptions {
  limit?: number;
  country?: string;
  lang?: string;
}

/**
 * Search Google Play for apps.
 *
 * Note:
 * Google Play search results provide basic discovery
 * information only. Detailed metadata such as ratings,
 * review count, installs and genre should be fetched
 * separately using the app details scraper.
 */
export async function searchApps(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const { limit = 20, country = "us", lang = "en" } = options;

  const results = await gplay.search({
    term: query,
    num: limit,
    country,
    lang,
  });

  return results.map((app) => ({
    appId: app.appId,
    title: app.title,
    developer: app.developer,
    icon: app.icon,
    score: app.score,
    url: app.url,
    description: app.summary,
  }));
}
