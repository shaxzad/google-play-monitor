import { Db } from "mongodb";
import type { ScrapedApp } from "../scraper/apps.js";

export async function createAppSnapshot(
  db: Db,
  app: ScrapedApp,
): Promise<void> {
  const snapshot = {
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

  await db.collection("app_snapshots").insertOne(snapshot);
}

export async function getAppHistory(db: Db, packageName: string, limit = 50) {
  return db
    .collection("app_snapshots")
    .find({
      packageName,
    })
    .sort({
      scrapedAt: -1,
    })
    .limit(limit)
    .toArray();
}
