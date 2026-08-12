import { Db } from "mongodb";
import type { ScrapedApp } from "../scraper/apps.js";

interface AppSnapshot {
  packageName: string;

  title?: string;
  developer?: string;
  genre?: string;

  score?: number;
  ratings?: number;
  reviews?: number;

  installs?: string;

  price?: number;
  free?: boolean;
  currency?: string;

  version?: string;
  updated?: string;

  scrapedAt: Date;
}

function buildSnapshot(app: ScrapedApp): AppSnapshot {
  return {
    packageName: app.packageName,

    title: app.title,
    developer: app.developer,
    genre: app.genre,

    score: app.score,
    ratings: app.ratings,
    reviews: app.reviews,

    installs: app.installs,

    price: app.price,
    free: app.free,
    currency: app.currency,

    version: app.version,
    updated: app.updated,

    scrapedAt: app.scrapedAt,
  };
}

/**
 * Only these fields determine whether a new snapshot
 * is meaningful.
 *
 * This prevents storing identical snapshots every
 * time sync:all runs.
 */
function getComparableSnapshot(snapshot: AppSnapshot) {
  return {
    score: snapshot.score,
    ratings: snapshot.ratings,
    reviews: snapshot.reviews,
    installs: snapshot.installs,
    price: snapshot.price,
    free: snapshot.free,
    currency: snapshot.currency,
    version: snapshot.version,
    updated: snapshot.updated,
  };
}

function snapshotsAreEqual(a: AppSnapshot, b: AppSnapshot): boolean {
  return (
    JSON.stringify(getComparableSnapshot(a)) ===
    JSON.stringify(getComparableSnapshot(b))
  );
}

/**
 * Creates a snapshot only when meaningful app data
 * has changed since the previous snapshot.
 */
export async function createAppSnapshot(
  db: Db,
  app: ScrapedApp,
): Promise<boolean> {
  const collection = db.collection<AppSnapshot>("app_snapshots");

  const snapshot = buildSnapshot(app);

  const previousSnapshot = await collection.findOne(
    {
      packageName: app.packageName,
    },
    {
      sort: {
        scrapedAt: -1,
      },
    },
  );

  if (previousSnapshot && snapshotsAreEqual(previousSnapshot, snapshot)) {
    return false;
  }

  await collection.insertOne(snapshot);

  return true;
}

/**
 * Returns historical snapshots for an app.
 */
export async function getAppHistory(db: Db, packageName: string, limit = 50) {
  return db
    .collection<AppSnapshot>("app_snapshots")
    .find({
      packageName,
    })
    .sort({
      scrapedAt: -1,
    })
    .limit(limit)
    .toArray();
}
