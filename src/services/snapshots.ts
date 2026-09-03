import type { Db } from "mongodb";

import type { AppPlatform } from "../types/platform.js";
import type { NormalizedApp } from "../types/app.js";

/**
 * Historical app metric snapshots.
 *
 * Identity is (platform, appId, scrapedAt). Every meaningful change produces
 * a new immutable snapshot — snapshots are never overwritten. Change-gating
 * avoids storing identical rows on every sync.
 */

export interface AppSnapshot {
  platform: AppPlatform;
  appId: string;

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
  /** Store's "last updated" time, as a real Date (epoch-ms fix). */
  updated?: Date;

  scrapedAt: Date;
}

function buildSnapshot(app: NormalizedApp, scrapedAt: Date): AppSnapshot {
  const snapshot: AppSnapshot = {
    platform: app.platform,
    appId: app.appId,
    scrapedAt,
  };

  if (app.name !== undefined) snapshot.title = app.name;
  if (app.developer !== undefined) snapshot.developer = app.developer;
  if (app.genre !== undefined) snapshot.genre = app.genre;
  if (app.score !== undefined) snapshot.score = app.score;
  if (app.ratings !== undefined) snapshot.ratings = app.ratings;
  if (app.reviews !== undefined) snapshot.reviews = app.reviews;
  if (app.installs !== undefined) snapshot.installs = app.installs;
  if (app.price !== undefined) snapshot.price = app.price;
  if (app.free !== undefined) snapshot.free = app.free;
  if (app.currency !== undefined) snapshot.currency = app.currency;
  if (app.version !== undefined) snapshot.version = app.version;
  if (app.updated !== undefined) snapshot.updated = app.updated;

  return snapshot;
}

/**
 * Only these fields determine whether a new snapshot is meaningful. This
 * prevents storing identical snapshots every time a sync runs.
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
    updated:
      snapshot.updated instanceof Date
        ? snapshot.updated.getTime()
        : snapshot.updated,
  };
}

export function snapshotsAreEqual(a: AppSnapshot, b: AppSnapshot): boolean {
  return (
    JSON.stringify(getComparableSnapshot(a)) ===
    JSON.stringify(getComparableSnapshot(b))
  );
}

/**
 * Create a snapshot only when meaningful app data has changed since the
 * previous snapshot for this (platform, appId). Returns true if a new
 * snapshot was inserted.
 */
export async function createAppSnapshot(
  db: Db,
  app: NormalizedApp,
  scrapedAt: Date = new Date(),
): Promise<boolean> {
  const collection = db.collection<AppSnapshot>("app_snapshots");

  const snapshot = buildSnapshot(app, scrapedAt);

  const previousSnapshot = await collection.findOne(
    { platform: app.platform, appId: app.appId },
    { sort: { scrapedAt: -1 } },
  );

  if (previousSnapshot && snapshotsAreEqual(previousSnapshot, snapshot)) {
    return false;
  }

  await collection.insertOne(snapshot);

  return true;
}

/** Historical snapshots for an app, newest first. */
export function getAppHistory(
  db: Db,
  platform: AppPlatform,
  appId: string,
  limit = 50,
): Promise<AppSnapshot[]> {
  return db
    .collection<AppSnapshot>("app_snapshots")
    .find({ platform, appId })
    .sort({ scrapedAt: -1 })
    .limit(limit)
    .toArray();
}
