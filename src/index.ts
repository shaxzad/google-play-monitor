import dotenv from "dotenv";

dotenv.config();

import type { Db } from "mongodb";

import { connectDB, closeDB } from "./db/mongodb.js";
import { GooglePlayProvider } from "./providers/google-play.js";
import type { AppStoreProvider } from "./providers/types.js";
import { syncActiveTargets, syncTarget } from "./services/sync-apps.js";
import { syncReviews } from "./services/sync-reviews.js";
import { seedMonitoredApps } from "./services/seed-monitored-apps.js";
import { discoverApps } from "./services/discover-apps.js";
import {
  addTarget,
  disableTarget,
  getActiveTargets,
  getTarget,
  listTargets,
  pauseTarget,
} from "./services/targets.js";
import type { AppPlatform } from "./types/platform.js";

const PLATFORM: AppPlatform = "google-play";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "apps";
  const arg = process.argv[3];

  const db = await connectDB();
  const provider = new GooglePlayProvider();

  try {
    switch (command) {
      case "apps":
        await runAppSync(db, provider);
        break;

      case "app":
        await runSingleAppSync(db, provider, arg);
        break;

      case "reviews":
        await runReviewSync(db, provider);
        break;

      case "all":
        await runAppSync(db, provider);
        await runReviewSync(db, provider);
        break;

      case "targets":
        await listAllTargets(db);
        break;

      case "target:add":
        await runTargetAdd(db, arg);
        break;

      case "target:pause":
        await runTargetPause(db, arg);
        break;

      case "target:disable":
        await runTargetDisable(db, arg);
        break;

      case "discover":
        await discoverApps(db, { limitPerQuery: 20 });
        break;

      case "seed":
        await seedMonitoredApps(db);
        break;

      default:
        printHelp();
        process.exitCode = 1;
    }
  } finally {
    await closeDB();
  }
}

/* -------------------------------------------------------------- app syncing */

async function runAppSync(
  db: Db,
  provider: AppStoreProvider,
): Promise<void> {
  console.log("\n🚀 App synchronization (active targets only)\n");

  const results = await syncActiveTargets(db, provider);

  const successful = results.filter((result) => result.success);
  const failed = results.filter((result) => !result.success);

  console.log("");
  console.log("================================");
  console.log("App Sync Completed");
  console.log("================================");
  console.log(`Total:      ${results.length.toString()}`);
  console.log(`Successful: ${successful.length.toString()}`);
  console.log(`Failed:     ${failed.length.toString()}`);

  if (failed.length > 0) {
    console.log("\nFailed apps:");
    for (const result of failed) {
      console.log(`- ${result.platform}:${result.appId}: ${result.error ?? ""}`);
    }
  }
}

async function runSingleAppSync(
  db: Db,
  provider: AppStoreProvider,
  appId: string | undefined,
): Promise<void> {
  if (!appId) {
    console.error("Usage: npm run dev app <appId>");
    process.exitCode = 1;
    return;
  }

  const target = await getTarget(db, PLATFORM, appId);

  if (!target) {
    console.error(
      `Refusing to fetch ${PLATFORM}:${appId} — no target exists. Add one first:\n  npm run dev target:add ${appId}`,
    );
    process.exitCode = 1;
    return;
  }

  if (target.status !== "active") {
    console.error(
      `Refusing to fetch ${PLATFORM}:${appId} — target status is "${target.status}". Activate it first.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n🚀 Syncing single target ${PLATFORM}:${appId}\n`);
  const result = await syncTarget(db, provider, target);

  if (!result.success) {
    process.exitCode = 1;
  }
}

async function runReviewSync(
  db: Db,
  provider: AppStoreProvider,
): Promise<void> {
  console.log("\n🚀 Review synchronization (active targets only)\n");

  const targets = await getActiveTargets(db, provider.platform);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let successful = 0;
  let failed = 0;

  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    console.log(`[${(index + 1).toString()}/${targets.length.toString()}]`);

    const result = await syncReviews(db, provider, target.appId, {
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

  console.log("");
  console.log("================================");
  console.log("Review Sync Completed");
  console.log("================================");
  console.log(`Targets:    ${targets.length.toString()}`);
  console.log(`Successful: ${successful.toString()}`);
  console.log(`Failed:     ${failed.toString()}`);
  console.log("");
  console.log(`Fetched:    ${totalFetched.toString()}`);
  console.log(`Inserted:   ${totalInserted.toString()}`);
  console.log(`Updated:    ${totalUpdated.toString()}`);
}

/* --------------------------------------------------------- target management */

async function listAllTargets(db: Db): Promise<void> {
  const targets = await listTargets(db);

  console.log(`\n🎯 Targets (${targets.length.toString()})\n`);

  if (targets.length === 0) {
    console.log("No targets yet. Add one with: npm run dev target:add <appId>");
    return;
  }

  for (const target of targets) {
    const checked = target.lastCheckedAt
      ? target.lastCheckedAt.toISOString()
      : "never";
    console.log(
      `${target.status.padEnd(9)} ${target.platform}:${target.appId}  (last checked: ${checked})`,
    );
  }
}

async function runTargetAdd(
  db: Db,
  appId: string | undefined,
): Promise<void> {
  if (!appId) {
    console.error("Usage: npm run dev target:add <appId>");
    process.exitCode = 1;
    return;
  }

  const target = await addTarget(db, { appId, platform: PLATFORM });
  console.log(
    `✓ Target ${target.platform}:${target.appId} is now "${target.status}"`,
  );
}

async function runTargetPause(
  db: Db,
  appId: string | undefined,
): Promise<void> {
  if (!appId) {
    console.error("Usage: npm run dev target:pause <appId>");
    process.exitCode = 1;
    return;
  }

  const matched = await pauseTarget(db, PLATFORM, appId);
  console.log(
    matched
      ? `✓ Paused ${PLATFORM}:${appId}`
      : `No target found for ${PLATFORM}:${appId}`,
  );

  if (!matched) {
    process.exitCode = 1;
  }
}

async function runTargetDisable(
  db: Db,
  appId: string | undefined,
): Promise<void> {
  if (!appId) {
    console.error("Usage: npm run dev target:disable <appId>");
    process.exitCode = 1;
    return;
  }

  const matched = await disableTarget(db, PLATFORM, appId);
  console.log(
    matched
      ? `✓ Disabled ${PLATFORM}:${appId} (history preserved)`
      : `No target found for ${PLATFORM}:${appId}`,
  );

  if (!matched) {
    process.exitCode = 1;
  }
}

function printHelp(): void {
  console.log(`
Google Play Monitor

Sync (only ACTIVE targets are ever fetched):
  npm run dev apps                 Sync all active targets
  npm run dev app <appId>          Sync a single active target
  npm run dev reviews              Sync reviews for all active targets
  npm run dev all                  Sync apps then reviews

Targets:
  npm run dev targets              List all targets and their status
  npm run dev target:add <appId>   Add (or upsert) a target — active by default
  npm run dev target:pause <appId> Pause a target (excluded from fetching)
  npm run dev target:disable <id>  Disable a target (soft; history preserved)

Discovery & seed:
  npm run dev discover             Stage search results as candidates (never fetched)
  npm run dev seed                 Seed example targets (no affiliate data)
`);
}

main().catch(async (error: unknown) => {
  console.error("\n💥 Fatal error:", error);
  await closeDB();
  process.exit(1);
});
