import { Db, MongoClient } from "mongodb";
import dotenv from "dotenv";

import { runMigrations } from "./migrations.js";

dotenv.config();

/**
 * Get a required environment variable.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not defined in .env`);
  }

  return value;
}

const mongoUri = getRequiredEnv("MONGODB_URI");
const dbName = getRequiredEnv("DB_NAME");

let client: MongoClient | null = null;
let database: Db | null = null;

/**
 * Connect to MongoDB.
 *
 * MongoDB is the source of truth for the project.
 */
export async function connectDB(): Promise<Db> {
  if (database) {
    return database;
  }

  client = new MongoClient(mongoUri);

  await client.connect();

  database = client.db(dbName);

  console.log(`✅ MongoDB connected: ${dbName}`);

  await runMigrations(database);

  await createIndexes(database);

  return database;
}

/**
 * Get the currently connected database.
 */
export function getDB(): Db {
  if (!database) {
    throw new Error("MongoDB is not connected. Call connectDB() first.");
  }

  return database;
}

/**
 * Create all required indexes.
 *
 * Indexes are intentionally kept minimal to avoid:
 * - unnecessary storage
 * - unnecessary write overhead
 * - duplicate indexes
 *
 * Collections:
 *
 * apps
 * - Master/source-of-truth app information
 *
 * reviews
 * - Individual Google Play reviews
 *
 * app_snapshots
 * - Historical app metric snapshots
 *
 * app_discoveries
 * - Search/discovery history
 *
 * monitored_apps
 * - Apps explicitly selected for monitoring
 */
async function createIndexes(db: Db): Promise<void> {
  /*
   * ==================================================
   * APPS  — identity (platform, appId)
   * ==================================================
   */

  await db
    .collection("apps")
    .createIndex(
      { platform: 1, appId: 1 },
      { unique: true, name: "apps_platform_appId_unique" },
    );

  await db.collection("apps").createIndex({ genre: 1 }, { name: "apps_genre" });
  await db
    .collection("apps")
    .createIndex({ score: -1 }, { name: "apps_score_desc" });
  await db
    .collection("apps")
    .createIndex({ ratings: -1 }, { name: "apps_ratings_desc" });
  await db
    .collection("apps")
    .createIndex({ updatedAt: -1 }, { name: "apps_updatedAt_desc" });

  /*
   * ==================================================
   * REVIEWS  — identity (platform, appId, reviewId)
   * ==================================================
   */

  await db
    .collection("reviews")
    .createIndex(
      { platform: 1, appId: 1, reviewId: 1 },
      { unique: true, name: "reviews_platform_appId_reviewId_unique" },
    );

  await db
    .collection("reviews")
    .createIndex(
      { platform: 1, appId: 1, publishedAt: -1 },
      { name: "reviews_platform_appId_publishedAt_desc" },
    );

  await db
    .collection("reviews")
    .createIndex(
      { platform: 1, appId: 1, rating: 1 },
      { name: "reviews_platform_appId_rating" },
    );

  /*
   * ==================================================
   * APP SNAPSHOTS  — history keyed (platform, appId, scrapedAt)
   * ==================================================
   */

  await db.collection("app_snapshots").createIndex(
    { platform: 1, appId: 1, scrapedAt: -1 },
    {
      unique: true,
      name: "snapshots_platform_appId_scrapedAt_desc_unique",
    },
  );

  /*
   * ==================================================
   * AFFILIATE TARGETS  — the fetch allowlist
   * ==================================================
   */

  await db
    .collection("affiliate_targets")
    .createIndex(
      { platform: 1, appId: 1 },
      { unique: true, name: "targets_platform_appId_unique" },
    );

  await db
    .collection("affiliate_targets")
    .createIndex({ status: 1 }, { name: "targets_status" });
  await db
    .collection("affiliate_targets")
    .createIndex(
      { operatorId: 1 },
      { name: "targets_operatorId", sparse: true },
    );
  await db
    .collection("affiliate_targets")
    .createIndex(
      { affiliateProgramId: 1 },
      { name: "targets_affiliateProgramId", sparse: true },
    );
  await db
    .collection("affiliate_targets")
    .createIndex(
      { affiliateCampaignId: 1 },
      { name: "targets_affiliateCampaignId", sparse: true },
    );
  await db
    .collection("affiliate_targets")
    .createIndex({ lastCheckedAt: 1 }, { name: "targets_lastCheckedAt" });

  /*
   * ==================================================
   * AFFILIATE ENTITIES
   * ==================================================
   */

  await db
    .collection("operators")
    .createIndex({ id: 1 }, { unique: true, name: "operators_id_unique" });
  await db
    .collection("operators")
    .createIndex({ slug: 1 }, { name: "operators_slug" });

  await db
    .collection("affiliate_programs")
    .createIndex({ id: 1 }, { unique: true, name: "programs_id_unique" });
  await db
    .collection("affiliate_programs")
    .createIndex({ operatorId: 1 }, { name: "programs_operatorId" });

  await db
    .collection("affiliate_campaigns")
    .createIndex({ id: 1 }, { unique: true, name: "campaigns_id_unique" });
  await db
    .collection("affiliate_campaigns")
    .createIndex(
      { affiliateProgramId: 1 },
      { name: "campaigns_affiliateProgramId" },
    );

  /*
   * ==================================================
   * APP CANDIDATES  — discovery staging (never fetched)
   * ==================================================
   */

  await db
    .collection("app_candidates")
    .createIndex(
      { platform: 1, appId: 1 },
      { unique: true, name: "candidates_platform_appId_unique" },
    );
  await db
    .collection("app_candidates")
    .createIndex({ status: 1 }, { name: "candidates_status" });
  await db
    .collection("app_candidates")
    .createIndex(
      { lastDiscoveredAt: -1 },
      { name: "candidates_lastDiscoveredAt_desc" },
    );

  console.log("✅ MongoDB indexes ready");
}

/**
 * Close MongoDB connection.
 */
export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();

    client = null;
    database = null;

    console.log("MongoDB connection closed");
  }
}
