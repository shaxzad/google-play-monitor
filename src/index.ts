import dotenv from "dotenv";

dotenv.config();

import { Db } from "mongodb";

import { connectDB, closeDB } from "./db/mongodb.js";

import { syncApps } from "./services/sync-apps.js";

import { syncReviews } from "./services/sync-reviews.js";

import { seedMonitoredApps } from "./services/seed-monitored-apps.js";

import { discoverApps } from "./services/discover-apps.js";

async function main(): Promise<void> {
  const command = process.argv[2] || "apps";

  const db = await connectDB();

  try {
    switch (command) {
      case "apps":
        await runAppSync(db);
        break;

      case "reviews":
        await runReviewSync(db);
        break;

      case "seed":
        await seedMonitoredApps(db);
        break;

      case "discover":
        await discoverApps({
          limitPerQuery: 20,
        });
        break;

      case "all":
        await runAppSync(db);
        await runReviewSync(db);
        break;

      default:
        printHelp();
        process.exitCode = 1;
    }
  } finally {
    await closeDB();
  }
}

async function getPackageNames(db: Db): Promise<string[]> {
  const apps = await db
    .collection<{ packageName?: string }>("apps")
    .find(
      {
        packageName: {
          $exists: true,
          $type: "string",
        },
      },
      {
        projection: {
          packageName: 1,
          _id: 0,
        },
      },
    )
    .toArray();

  return Array.from(
    new Set(
      apps
        .map((app) => app.packageName?.trim())
        .filter((packageName): packageName is string => Boolean(packageName)),
    ),
  );
}

async function runAppSync(db: Db): Promise<void> {
  console.log("\n🚀 App synchronization\n");

  const packageNames = await getPackageNames(db);

  const results = await syncApps(db, packageNames);

  const successful = results.filter((result) => result.success);

  const failed = results.filter((result) => !result.success);

  console.log("");
  console.log("================================");
  console.log("App Sync Completed");
  console.log("================================");

  console.log(`Total:      ${results.length}`);

  console.log(`Successful: ${successful.length}`);

  console.log(`Failed:     ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailed apps:");

    for (const result of failed) {
      console.log(`- ${result.packageName}: ${result.error}`);
    }
  }
}

async function runReviewSync(db: Db): Promise<void> {
  console.log("\n🚀 Review synchronization\n");

  const packageNames = await getPackageNames(db);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalUpdated = 0;

  let successful = 0;
  let failed = 0;

  for (let index = 0; index < packageNames.length; index++) {
    const packageName = packageNames[index];

    console.log(`[${index + 1}/${packageNames.length}]`);

    console.log(`📝 Syncing reviews: ${packageName}`);

    try {
      const result = await syncReviews(db, packageName, {
        num: 100,
        sort: 2,
        maxPages: 1,
      });

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      totalFetched += result.fetched;
      totalInserted += result.inserted;
      totalUpdated += result.updated;
    } catch (error) {
      failed++;

      console.error(
        `❌ Reviews failed for ${packageName}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log("");
  console.log("================================");
  console.log("Review Sync Completed");
  console.log("================================");

  console.log(`Apps:       ${packageNames.length}`);

  console.log(`Successful: ${successful}`);

  console.log(`Failed:     ${failed}`);

  console.log("");

  console.log(`Fetched:    ${totalFetched}`);

  console.log(`Inserted:   ${totalInserted}`);

  console.log(`Updated:    ${totalUpdated}`);
}

function printHelp(): void {
  console.log(`
Google Play Monitor

Commands:

npm run sync:apps
Synchronize all apps stored in MongoDB

npm run sync:reviews
Synchronize reviews for all apps stored in MongoDB

npm run sync:all
Synchronize apps and reviews

npm run discover
Discover new apps from Google Play search queries

npm run seed
Seed monitored apps
`);
}

main().catch(async (error) => {
  console.error("\n💥 Fatal error:", error);

  await closeDB();

  process.exit(1);
});
