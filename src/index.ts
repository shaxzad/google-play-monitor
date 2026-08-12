import dotenv from "dotenv";

dotenv.config();

import apps from "./data/apps.js";

import { Db } from "mongodb";

import { connectDB, closeDB } from "./db/mongodb.js";

import { syncApps } from "./services/sync-apps.js";

import { syncReviews } from "./services/sync-reviews.js";

import { seedMonitoredApps } from "./services/seed-monitored-apps.js";

async function main() {
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

async function runAppSync(db: Db): Promise<void> {
  console.log("\n🚀 App synchronization\n");

  const results = await syncApps(db, apps);

  const successful = results.filter((result) => result.success);

  const failed = results.filter((result) => !result.success);

  console.log(`
================================
App Sync Completed
================================

Total:      ${results.length}
Successful: ${successful.length}
Failed:     ${failed.length}
`);

  if (failed.length > 0) {
    console.log("Failed apps:");

    for (const result of failed) {
      console.log(`- ${result.packageName}: ${result.error}`);
    }
  }
}

async function runReviewSync(db: Db): Promise<void> {
  console.log("\n🚀 Review synchronization\n");

  let totalFetched = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let successful = 0;
  let failed = 0;

  for (let index = 0; index < apps.length; index++) {
    const packageName = apps[index];

    console.log(`[${index + 1}/${apps.length}]`);

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
  }

  console.log(`
================================
Review Sync Completed
================================

Apps:       ${apps.length}
Successful: ${successful}
Failed:     ${failed}

Fetched:    ${totalFetched}
Inserted:   ${totalInserted}
Updated:    ${totalUpdated}
`);
}

function printHelp(): void {
  console.log(`
Google Play Monitor

Commands:

  npm run sync:apps
      Synchronize app information

  npm run sync:reviews
      Synchronize latest reviews

  npm run sync:all
      Synchronize apps and reviews
`);
}

main().catch(async (error) => {
  console.error("\n💥 Fatal error:", error);

  await closeDB();

  process.exit(1);
});
