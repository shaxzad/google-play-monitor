import { Db, MongoClient } from "mongodb";
import dotenv from "dotenv";

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
   * APPS
   * ==================================================
   *
   * One document per Google Play package.
   *
   * This is the main source-of-truth collection.
   */

  await db.collection("apps").createIndex(
    { packageName: 1 },
    {
      unique: true,
      name: "apps_packageName_unique",
    },
  );

  /*
   * Useful for filtering applications by category.
   */
  await db.collection("apps").createIndex(
    { genre: 1 },
    {
      name: "apps_genre",
    },
  );

  /*
   * Useful for recommendation/filtering by rating.
   */
  await db.collection("apps").createIndex(
    { score: -1 },
    {
      name: "apps_score_desc",
    },
  );

  /*
   * Useful for popularity filtering.
   */
  await db.collection("apps").createIndex(
    { ratings: -1 },
    {
      name: "apps_ratings_desc",
    },
  );

  /*
   * Useful for filtering by number of reviews.
   */
  await db.collection("apps").createIndex(
    { reviews: -1 },
    {
      name: "apps_reviews_desc",
    },
  );

  /*
   * Useful for finding recently updated/scraped apps.
   */
  await db.collection("apps").createIndex(
    { updatedAt: -1 },
    {
      name: "apps_updatedAt_desc",
    },
  );

  /*
   * ==================================================
   * REVIEWS
   * ==================================================
   *
   * One review per:
   *
   * packageName + reviewId
   *
   * reviewId is checked before saving in sync-reviews.ts,
   * therefore sparse indexing is not required.
   */

  await db.collection("reviews").createIndex(
    {
      packageName: 1,
      reviewId: 1,
    },
    {
      unique: true,
      name: "reviews_packageName_reviewId_unique",
    },
  );

  /*
   * Useful for:
   *
   * GET /apps/:packageName/reviews
   *
   * sorted by newest.
   */
  await db.collection("reviews").createIndex(
    {
      packageName: 1,
      publishedAt: -1,
    },
    {
      name: "reviews_packageName_publishedAt_desc",
    },
  );

  /*
   * Useful for filtering reviews by rating.
   *
   * Example:
   * - 1 star reviews
   * - 5 star reviews
   */
  await db.collection("reviews").createIndex(
    {
      packageName: 1,
      rating: 1,
    },
    {
      name: "reviews_packageName_rating",
    },
  );

  /*
   * ==================================================
   * APP SNAPSHOTS
   * ==================================================
   *
   * Historical app metrics.
   *
   * Example:
   *
   * Day 1:
   * score = 4.5
   * reviews = 100000
   *
   * Day 2:
   * score = 4.4
   * reviews = 101000
   *
   * This allows future analytics and trend detection.
   */

  await db.collection("app_snapshots").createIndex(
    {
      packageName: 1,
      scrapedAt: -1,
    },
    {
      name: "snapshots_packageName_scrapedAt_desc",
    },
  );

  /*
   * ==================================================
   * APP DISCOVERIES
   * ==================================================
   *
   * Search/discovery history.
   *
   * Example:
   *
   * query:
   * "casino slots real money"
   *
   * app:
   * com.example.casino
   *
   * rank:
   * 3
   *
   * This information can later be used for:
   *
   * - search popularity
   * - ranking analysis
   * - category analysis
   * - recommendation scoring
   * - affiliate research
   */

  await db.collection("app_discoveries").createIndex(
    {
      packageName: 1,
      query: 1,
      discoveredAt: 1,
    },
    {
      unique: true,
      name: "discoveries_package_query_date_unique",
    },
  );

  /*
   * Find recent results for a particular search query.
   */
  await db.collection("app_discoveries").createIndex(
    {
      query: 1,
      discoveredAt: -1,
    },
    {
      name: "discoveries_query_date_desc",
    },
  );

  /*
   * Find discovery history for a particular application.
   */
  await db.collection("app_discoveries").createIndex(
    {
      packageName: 1,
      discoveredAt: -1,
    },
    {
      name: "discoveries_package_date_desc",
    },
  );

  /*
   * Useful for analyzing app ranking within a search query.
   */
  await db.collection("app_discoveries").createIndex(
    {
      query: 1,
      rank: 1,
    },
    {
      name: "discoveries_query_rank",
    },
  );

  /*
   * ==================================================
   * MONITORED APPS
   * ==================================================
   *
   * Apps explicitly selected for ongoing monitoring.
   */

  await db.collection("monitored_apps").createIndex(
    {
      packageName: 1,
    },
    {
      unique: true,
      name: "monitored_apps_packageName_unique",
    },
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
