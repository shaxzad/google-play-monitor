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
  await db.collection("apps").createIndex({ packageName: 1 }, { unique: true });

  await db.collection("app_snapshots").createIndex({
    packageName: 1,
    scrapedAt: -1,
  });

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
