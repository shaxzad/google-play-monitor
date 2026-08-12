import { Collection } from "mongodb";

import { getDB } from "../db/mongodb.js";

import { scrapeApp, type ScrapedApp } from "../scraper/apps.js";

import { searchApps, type SearchResult } from "../scraper/search.js";

import searchQueries from "../data/search-queries.js";

interface DiscoveryRecord {
  packageName: string;
  query: string;
  rank: number;
  discoveredAt: Date;
}

export interface AppDocument extends ScrapedApp {
  packageName: string;

  discovery?: {
    queries: string[];
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

function getDiscoveryCollection(): Collection<DiscoveryRecord> {
  return getDB().collection<DiscoveryRecord>("app_discoveries");
}

/**
 * Ensures indexes required by discovery.
 */
export async function ensureDiscoveryIndexes(): Promise<void> {
  const appsCollection = getAppsCollection();
  const discoveryCollection = getDiscoveryCollection();

  await appsCollection.createIndex({ packageName: 1 }, { unique: true });

  await appsCollection.createIndex({
    "discovery.queries": 1,
  });

  await appsCollection.createIndex({
    "discovery.lastDiscoveredAt": -1,
  });

  await appsCollection.createIndex({
    updatedAt: -1,
  });

  await discoveryCollection.createIndex(
    {
      packageName: 1,
      query: 1,
      discoveredAt: 1,
    },
    {
      unique: true,
    },
  );

  await discoveryCollection.createIndex({
    query: 1,
    discoveredAt: -1,
  });

  await discoveryCollection.createIndex({
    packageName: 1,
    discoveredAt: -1,
  });
}

/**
 * Discover apps from Google Play searches.
 *
 * Search results are first deduplicated by packageName.
 *
 * Then complete app information is fetched once for
 * each unique app.
 *
 * Current app information is stored in `apps`.
 *
 * Search/ranking history is stored in `app_discoveries`.
 */
export async function discoverApps(
  options: DiscoverOptions = {},
): Promise<void> {
  const {
    limitPerQuery = 20,
    country = "us",
    lang = "en",
    delayMs = 1000,
  } = options;

  const appsCollection = getAppsCollection();
  const discoveryCollection = getDiscoveryCollection();

  await ensureDiscoveryIndexes();

  console.log("\n🔎 Google Play App Discovery");
  console.log("================================");
  console.log(`Queries:       ${searchQueries.length}`);
  console.log(`Limit/query:   ${limitPerQuery}`);
  console.log(`Country:       ${country}`);
  console.log(`Language:      ${lang}`);
  console.log("");

  /*
   * --------------------------------------------------
   * STEP 1
   *
   * Search Google Play.
   *
   * Map packageName -> SearchResult + discovery data.
   *
   * This prevents scraping the same app multiple times
   * if it appears in multiple queries.
   * --------------------------------------------------
   */

  const discovered = new Map<
    string,
    {
      app: SearchResult;
      discoveries: DiscoveryRecord[];
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

      for (let index = 0; index < results.length; index++) {
        const result = results[index];

        const packageName = result.appId?.trim();

        if (!packageName) {
          continue;
        }

        const discovery: DiscoveryRecord = {
          packageName,
          query,
          rank: index + 1,
          discoveredAt: new Date(),
        };

        const existing = discovered.get(packageName);

        if (existing) {
          existing.discoveries.push(discovery);
        } else {
          discovered.set(packageName, {
            app: result,
            discoveries: [discovery],
          });
        }
      }

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
   * STEP 2
   *
   * Fetch complete app information.
   * --------------------------------------------------
   */

  let appsInserted = 0;
  let appsUpdated = 0;
  let scrapeFailed = 0;
  let discoveryInserted = 0;

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
       * ----------------------------------------------
       * SAVE CURRENT APP INFORMATION
       * ----------------------------------------------
       */

      const existing = await appsCollection.findOne({
        packageName,
      });

      if (!existing) {
        const appDocument: AppDocument = {
          ...scrapedApp,

          /*
           * Do not persist `raw`.
           *
           * The scraper may return it internally,
           * but it should not become duplicated
           * MongoDB storage.
           */
          raw: undefined,

          packageName,

          discovery: {
            queries: uniqueStrings(
              discoveryData.discoveries.map((item) => item.query),
            ),

            firstDiscoveredAt: now,
            lastDiscoveredAt: now,
          },

          createdAt: now,
          updatedAt: now,
        };

        /*
         * Remove raw completely before inserting.
         */
        delete appDocument.raw;

        await appsCollection.insertOne(appDocument);

        appsInserted++;

        console.log(`   ✓ ${scrapedApp.title ?? packageName} inserted`);
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

        /*
         * Preserve original createdAt.
         *
         * Only current app information is replaced.
         */
        const updatedApp = {
          ...scrapedApp,
        };

        delete updatedApp.raw;

        await appsCollection.updateOne(
          {
            packageName,
          },
          {
            $set: {
              ...updatedApp,

              packageName,

              "discovery.queries": newQueries,

              "discovery.lastDiscoveredAt": now,

              updatedAt: now,
            },
          },
        );

        appsUpdated++;

        console.log(`   ✓ ${scrapedApp.title ?? packageName} updated`);
      }

      /*
       * --------------------------------------------
       * SAVE DISCOVERY HISTORY
       * --------------------------------------------
       *
       * Each discovery is stored separately.
       *
       * The unique index prevents exact duplicates.
       *
       * If the same app appears in another query,
       * that becomes another discovery record.
       */

      for (const discovery of discoveryData.discoveries) {
        try {
          const result = await discoveryCollection.updateOne(
            {
              packageName: discovery.packageName,

              query: discovery.query,

              discoveredAt: discovery.discoveredAt,
            },
            {
              $setOnInsert: discovery,
            },
            {
              upsert: true,
            },
          );

          if (result.upsertedCount > 0) {
            discoveryInserted++;
          }
        } catch (error) {
          /*
           * Duplicate-key race conditions should not
           * make the entire discovery process fail.
           */
          if (!isDuplicateKeyError(error)) {
            throw error;
          }
        }
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

  console.log(`Search results:       ${searchFetched}`);
  console.log(`Unique apps:          ${discovered.size}`);
  console.log(`Apps inserted:        ${appsInserted}`);
  console.log(`Apps updated:         ${appsUpdated}`);
  console.log(`Discoveries inserted: ${discoveryInserted}`);
  console.log(`Failed searches:      ${searchFailed}`);
  console.log(`Failed app scrape:    ${scrapeFailed}`);
  console.log("");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
