import type { Db } from "mongodb";

import { searchApps } from "../scraper/search.js";
import searchQueries from "../data/search-queries.js";
import { recordCandidate } from "./candidates.js";

/**
 * Discovery → candidate staging.
 *
 * Discovery runs Google Play searches and records what it finds as
 * CANDIDATES in `app_candidates` for later human review. It intentionally:
 *
 * - does NOT fetch full app details,
 * - does NOT write to the `apps` collection,
 * - does NOT create or activate affiliate targets.
 *
 * Promoting a candidate into an active target is a separate, explicit action
 * (see targets.addTarget / the `target:add` CLI command). Discovery finding
 * an app never causes it to be monitored automatically.
 */

interface DiscoverOptions {
  limitPerQuery?: number;
  country?: string;
  lang?: string;
  delayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function discoverApps(
  db: Db,
  options: DiscoverOptions = {},
): Promise<void> {
  const {
    limitPerQuery = 20,
    country = process.env.GOOGLE_PLAY_COUNTRY ?? "us",
    lang = process.env.GOOGLE_PLAY_LANGUAGE ?? "en",
    delayMs = 1000,
  } = options;

  console.log("\n🔎 Google Play App Discovery (candidate staging)");
  console.log("================================");
  console.log(`Queries:       ${searchQueries.length.toString()}`);
  console.log(`Limit/query:   ${limitPerQuery.toString()}`);
  console.log(`Country:       ${country}`);
  console.log(`Language:      ${lang}`);
  console.log("");

  let searchFetched = 0;
  let searchFailed = 0;
  let candidatesRecorded = 0;

  for (let i = 0; i < searchQueries.length; i++) {
    const query = searchQueries[i];

    console.log(
      `[SEARCH ${(i + 1).toString()}/${searchQueries.length.toString()}] 🔍 "${query}"`,
    );

    try {
      const results = await searchApps(query, {
        limit: limitPerQuery,
        country,
        lang,
      });

      console.log(`   Found ${results.length.toString()} apps`);
      searchFetched += results.length;

      for (let index = 0; index < results.length; index++) {
        const app = results[index];
        const discoveredAt = new Date();

        await recordCandidate(db, {
          appId: app.appId,
          title: app.title,
          developer: app.developer,
          sighting: { query, rank: index + 1, discoveredAt },
        });

        candidatesRecorded++;
      }

      console.log("   ✓ Candidates recorded");
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
  console.log("Discovery Completed");
  console.log("================================");
  console.log(`Search results:      ${searchFetched.toString()}`);
  console.log(`Candidates recorded: ${candidatesRecorded.toString()}`);
  console.log(`Failed searches:     ${searchFailed.toString()}`);
  console.log("");
  console.log(
    "Candidates are staged for review. None were fetched or promoted to targets.",
  );
  console.log("");
}
