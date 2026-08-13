import { Collection } from "mongodb";

import { getDB } from "../db/mongodb.js";
import { scrapeApp, type ScrapedApp } from "../scraper/apps.js";
import { searchApps, type SearchResult } from "../scraper/search.js";
import searchQueries from "../data/search-queries.js";

interface DiscoveryInfo {
  query: string;
  rank: number;
  discoveredAt: Date;
}

export interface AppDocument extends ScrapedApp {
  packageName: string;

  discovery?: {
    queries: string[];
    results: DiscoveryInfo[];
    firstDiscoveredAt: Date;
    lastDiscoveredAt: Date;
  };

  affiliate?: {
    enabled: boolean;
    network?: string;
    affiliateUrl?: string;
    trackingId?: string;
    commissionType?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

interface DiscoverOptions {
  limitPerQuery?: number;
  country?: string;
  lang?: string;
  delayMs?: number;
}

function getAppsCollection(): Collection<AppDocument> {
  return getDB().collection<AppDocument>("apps");
}

/**
 * Discover apps from Google Play search and save
 * complete app information into the master `apps`
 * collection.
 *
 * IMPORTANT:
 * Database indexes are managed centrally in
 * src/db/mongodb.ts.
 *
 * This service does NOT create indexes.
 */
export async function discoverApps(
  options: DiscoverOptions = {},
): Promise<void> {
  const {
    limitPerQuery = 20,
    country = process.env.GOOGLE_PLAY_COUNTRY || "us",
    lang = process.env.GOOGLE_PLAY_LANGUAGE || "en",
    delayMs = 1000,
  } = options;

  const collection = getAppsCollection();

  console.log("\n🔎 Google Play App Discovery");
  console.log("================================");
  console.log(`Queries:       ${searchQueries.length}`);
  console.log(`Limit/query:   ${limitPerQuery}`);
  console.log(`Country:       ${country}`);
  console.log(`Language:      ${lang}`);
  console.log("");

  /*
   * --------------------------------------------------
   * STEP 1: SEARCH GOOGLE PLAY
   * --------------------------------------------------
   *
   * First collect all search results.
   *
   * Map key = packageName.
   *
   * This prevents scraping the same app multiple
   * times when it appears in multiple searches.
   */
  const discovered = new Map<
    string,
    {
      app: SearchResult;
      discoveries: DiscoveryInfo[];
    }
  >();

  let searchFetched = 0;
  let searchFailed = 0;

  for (let i = 0; i < searchQueries.length; i++) {
    const query = searchQueries[i];

    console.log(`[SEARCH ${i + 1}/${searchQueries.length}] 🔍 "${query}"`);

    try {
      const results = await searchApps(query, {
        limit: limitPerQuery,
        country,
        lang,
      });

      console.log(`   Found ${results.length} apps`);

      searchFetched += results.length;

      results.forEach((app, index) => {
        const rank = index + 1;

        const discovery: DiscoveryInfo = {
          query,
          rank,
          discoveredAt: new Date(),
        };

        const existing = discovered.get(app.appId);

        if (existing) {
          existing.discoveries.push(discovery);
        } else {
          discovered.set(app.appId, {
            app,
            discoveries: [discovery],
          });
        }
      });

      console.log("   ✓ Search complete");
    } catch (error) {
      searchFailed++;

      console.error(
        `   ✗ Search failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log("");
  console.log("================================");
  console.log("Search Completed");
  console.log("================================");

  console.log(`Search results:    ${searchFetched}`);
  console.log(`Unique apps:       ${discovered.size}`);
  console.log(`Failed searches:   ${searchFailed}`);
  console.log("");

  /*
   * --------------------------------------------------
   * STEP 2: SCRAPE FULL APP DETAILS
   * --------------------------------------------------
   *
   * Search results are NOT the source of truth.
   *
   * For every unique packageName, fetch the complete
   * Google Play app document using scrapeApp().
   */
  let appsInserted = 0;
  let appsUpdated = 0;
  let scrapeFailed = 0;

  const discoveredApps = Array.from(discovered.entries());

  for (let i = 0; i < discoveredApps.length; i++) {
    const [packageName, discoveryData] = discoveredApps[i];

    console.log(`[APP ${i + 1}/${discoveredApps.length}] 🔍 ${packageName}`);

    try {
      const scrapedApp = await scrapeApp(packageName);

      if (!scrapedApp) {
        console.log("   ✗ No app data returned");
        scrapeFailed++;
        continue;
      }

      const now = new Date();

      /*
       * Find the existing master app document.
       *
       * packageName is the unique source-of-truth key.
       */
      const existing = await collection.findOne({
        packageName,
      });

      if (!existing) {
        /*
         * --------------------------------------------
         * NEW APP
         * --------------------------------------------
         */

        const appDocument: AppDocument = {
          ...scrapedApp,

          packageName,

          discovery: {
            queries: uniqueQueries(discoveryData.discoveries),

            results: deduplicateDiscoveryResults(discoveryData.discoveries),

            firstDiscoveredAt: now,

            lastDiscoveredAt: now,
          },

          createdAt: now,

          updatedAt: now,
        };

        await collection.insertOne(appDocument);

        appsInserted++;

        console.log(`   ✓ ${scrapedApp.title || packageName} inserted`);
      } else {
        /*
         * --------------------------------------------
         * EXISTING APP
         * --------------------------------------------
         */

        const existingQueries = existing.discovery?.queries ?? [];

        const newQueries = uniqueStrings([
          ...existingQueries,

          ...discoveryData.discoveries.map((item) => item.query),
        ]);

        const existingDiscoveries = existing.discovery?.results ?? [];

        const mergedDiscoveries = mergeDiscoveryResults(
          existingDiscoveries,
          discoveryData.discoveries,
        );

        /*
         * Update the master app document.
         *
         * The latest scrape replaces the current app
         * metadata, while discovery history is merged
         * without duplicates.
         */
        await collection.updateOne(
          {
            packageName,
          },
          {
            $set: {
              ...scrapedApp,

              packageName,

              "discovery.queries": newQueries,

              "discovery.results": mergedDiscoveries,

              "discovery.lastDiscoveredAt": now,

              updatedAt: now,
            },
          },
        );

        appsUpdated++;

        console.log(`   ✓ ${scrapedApp.title || packageName} updated`);
      }
    } catch (error) {
      scrapeFailed++;

      console.error(
        `   ✗ Failed ${packageName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  /*
   * --------------------------------------------------
   * FINAL SUMMARY
   * --------------------------------------------------
   */

  console.log("");
  console.log("================================");
  console.log("Discovery Completed");
  console.log("================================");

  console.log(`Search results:    ${searchFetched}`);
  console.log(`Unique apps:       ${discovered.size}`);
  console.log(`Apps inserted:     ${appsInserted}`);
  console.log(`Apps updated:      ${appsUpdated}`);
  console.log(`Failed searches:   ${searchFailed}`);
  console.log(`Failed app scrape: ${scrapeFailed}`);
  console.log("");
}

/**
 * Return unique strings while preserving order.
 */
function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Extract unique search queries from discovery records.
 */
function uniqueQueries(discoveries: DiscoveryInfo[]): string[] {
  return uniqueStrings(discoveries.map((item) => item.query));
}

/**
 * Remove duplicate discovery records.
 *
 * Same query + same rank represents the same search
 * position for our purposes.
 */
function deduplicateDiscoveryResults(
  discoveries: DiscoveryInfo[],
): DiscoveryInfo[] {
  const unique = new Map<string, DiscoveryInfo>();

  for (const item of discoveries) {
    const key = `${item.query}::${item.rank}`;

    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return Array.from(unique.values());
}

/**
 * Merge existing and incoming discovery records
 * without creating duplicates.
 */
function mergeDiscoveryResults(
  existing: DiscoveryInfo[],
  incoming: DiscoveryInfo[],
): DiscoveryInfo[] {
  const merged = [...existing];

  for (const incomingItem of incoming) {
    const alreadyExists = merged.some(
      (item) =>
        item.query === incomingItem.query && item.rank === incomingItem.rank,
    );

    if (!alreadyExists) {
      merged.push(incomingItem);
    }
  }

  return merged;
}

/**
 * Delay helper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
