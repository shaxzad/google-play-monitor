import { Db, MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

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

export function getDB(): Db {
  if (!database) {
    throw new Error("MongoDB is not connected. Call connectDB() first.");
  }

  return database;
}

async function createIndexes(db: Db): Promise<void> {
  /*
   * --------------------------------------------------
   * APPS
   * --------------------------------------------------
   *
   * One document per Google Play package.
   */
  await db.collection("apps").createIndex({ packageName: 1 }, { unique: true });

  await db.collection("apps").createIndex({
    genre: 1,
  });

  await db.collection("apps").createIndex({
    score: -1,
  });

  await db.collection("apps").createIndex({
    ratings: -1,
  });

  await db.collection("apps").createIndex({
    reviews: -1,
  });

  await db.collection("apps").createIndex({
    updatedAt: -1,
  });

  /*
   * --------------------------------------------------
   * REVIEWS
   * --------------------------------------------------
   *
   * One review per packageName + reviewId.
   */
  await db.collection("reviews").createIndex(
    {
      packageName: 1,
      reviewId: 1,
    },
    {
      unique: true,
      sparse: true,
    },
  );

  await db.collection("reviews").createIndex({
    packageName: 1,
    publishedAt: -1,
  });

  await db.collection("reviews").createIndex({
    rating: 1,
  });

  /*
   * --------------------------------------------------
   * APP SNAPSHOTS
   * --------------------------------------------------
   *
   * Historical app metrics.
   */
  await db.collection("app_snapshots").createIndex({
    packageName: 1,
    scrapedAt: -1,
  });

  /*
   * Prevent exact duplicate snapshots.
   *
   * The snapshot service also checks whether the
   * metrics actually changed before inserting.
   */
  await db.collection("app_snapshots").createIndex({
    packageName: 1,
    scrapedAt: 1,
  });

  /*
   * --------------------------------------------------
   * APP DISCOVERIES
   * --------------------------------------------------
   *
   * Search/ranking history.
   */
  await db.collection("app_discoveries").createIndex(
    {
      packageName: 1,
      query: 1,
      discoveredAt: 1,
    },
    {
      unique: true,
    },
  );

  await db.collection("app_discoveries").createIndex({
    query: 1,
    discoveredAt: -1,
  });

  await db.collection("app_discoveries").createIndex({
    packageName: 1,
    discoveredAt: -1,
  });

  await db.collection("app_discoveries").createIndex({
    query: 1,
    rank: 1,
  });

  /*
   * --------------------------------------------------
   * MONITORED APPS
   * --------------------------------------------------
   */
  await db
    .collection("monitored_apps")
    .createIndex({ packageName: 1 }, { unique: true });

  console.log("✅ MongoDB indexes ready");
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();

    client = null;
    database = null;

    console.log("MongoDB connection closed");
  }
}
