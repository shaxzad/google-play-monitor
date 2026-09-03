import type { Db } from "mongodb";

import type { AppPlatform } from "../types/platform.js";

/**
 * Idempotent, non-destructive migrations.
 *
 * These run automatically on connect, BEFORE index creation, so that the new
 * unique indexes (e.g. apps.{platform,appId}) can be built on already-
 * backfilled data.
 *
 * Guarantees:
 * - Never deletes documents or collections.
 * - Never invents affiliate relationships.
 * - Never removes existing `raw` fields from historical documents.
 * - Safe to run repeatedly (each step is guarded by a filter so a second run
 *   is a no-op).
 *
 * Obsolete indexes from the previous schema are dropped defensively (dropping
 * an index does not touch the underlying data), because the old unique index
 * on `apps.packageName` would otherwise conflict with the new identity.
 */

const GOOGLE_PLAY: AppPlatform = "google-play";

/** Index names from the previous schema that must not linger. */
const OBSOLETE_INDEXES: Record<string, string[]> = {
  apps: ["apps_packageName_unique", "apps_reviews_desc"],
  reviews: [
    "reviews_packageName_reviewId_unique",
    "reviews_packageName_publishedAt_desc",
    "reviews_packageName_rating",
  ],
  app_snapshots: ["snapshots_packageName_scrapedAt_desc"],
  monitored_apps: ["monitored_apps_packageName_unique"],
};

export async function runMigrations(db: Db): Promise<void> {
  await dropObsoleteIndexes(db);
  await backfillPlatformAndAppId(db, "apps");
  await backfillPlatformAndAppId(db, "reviews");
  await backfillPlatformAndAppId(db, "app_snapshots");
  await migrateMonitoredAppsToTargets(db);
  console.log("✅ Migrations complete");
}

/**
 * Drop indexes that belonged to the packageName-based schema. Dropping an
 * index is safe: it removes only the index, never the documents.
 */
async function dropObsoleteIndexes(db: Db): Promise<void> {
  for (const [collectionName, indexNames] of Object.entries(OBSOLETE_INDEXES)) {
    const collection = db.collection(collectionName);

    let existing: { name?: string }[];
    try {
      existing = await collection.indexes();
    } catch {
      // Collection doesn't exist yet — nothing to drop.
      continue;
    }

    const present = new Set(existing.map((index) => index.name));

    for (const name of indexNames) {
      if (present.has(name)) {
        try {
          await collection.dropIndex(name);
          console.log(`  · dropped obsolete index ${collectionName}.${name}`);
        } catch {
          // Best-effort: ignore if it vanished between listing and dropping.
        }
      }
    }
  }
}

/**
 * Backfill `platform` (defaults to google-play) and `appId` (copied from the
 * legacy `packageName`) on any document missing them. Existing values are
 * never overwritten; `packageName` is preserved.
 */
async function backfillPlatformAndAppId(
  db: Db,
  collectionName: string,
): Promise<void> {
  const collection = db.collection(collectionName);

  // Set platform where missing.
  const platformResult = await collection.updateMany(
    { platform: { $exists: false } },
    { $set: { platform: GOOGLE_PLAY } },
  );

  // Copy packageName → appId where appId is missing but packageName exists.
  const appIdResult = await collection.updateMany(
    { appId: { $exists: false }, packageName: { $exists: true, $type: "string" } },
    [{ $set: { appId: "$packageName" } }],
  );

  const changed = platformResult.modifiedCount + appIdResult.modifiedCount;

  if (changed > 0) {
    console.log(
      `  · backfilled ${collectionName}: +${platformResult.modifiedCount.toString()} platform, +${appIdResult.modifiedCount.toString()} appId`,
    );
  }
}

/**
 * Copy legacy `monitored_apps` into `affiliate_targets` as targets, preserving
 * their active flag as a target status. Idempotent: only inserts a target when
 * one does not already exist for (platform, appId). Original monitored_apps
 * documents are left untouched.
 */
async function migrateMonitoredAppsToTargets(db: Db): Promise<void> {
  const monitored = db.collection<{
    packageName?: string;
    active?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    lastSyncedAt?: Date;
  }>("monitored_apps");

  let legacy: Array<{
    packageName?: string;
    active?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    lastSyncedAt?: Date;
  }>;

  try {
    legacy = await monitored.find({}).toArray();
  } catch {
    return;
  }

  if (legacy.length === 0) {
    return;
  }

  const targets = db.collection("affiliate_targets");
  let migrated = 0;

  for (const doc of legacy) {
    const appId = doc.packageName?.trim();
    if (!appId) {
      continue;
    }

    const existing = await targets.findOne({ platform: GOOGLE_PLAY, appId });
    if (existing) {
      continue;
    }

    const now = new Date();
    await targets.insertOne({
      id: `${GOOGLE_PLAY}:${appId}`,
      platform: GOOGLE_PLAY,
      appId,
      status: doc.active === false ? "paused" : "active",
      allowedGeos: [],
      restrictedGeos: [],
      createdAt: doc.createdAt ?? now,
      updatedAt: now,
      ...(doc.lastSyncedAt ? { lastCheckedAt: doc.lastSyncedAt } : {}),
    });

    migrated++;
  }

  if (migrated > 0) {
    console.log(
      `  · migrated ${migrated.toString()} monitored_apps → affiliate_targets`,
    );
  }
}
