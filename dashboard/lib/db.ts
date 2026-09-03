import { Db, MongoClient } from "mongodb";

/**
 * Get a required environment variable.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not defined in .env.local`);
  }

  return value;
}

let client: MongoClient | null = null;
let database: Db | null = null;

/**
 * Connect to MongoDB.
 */
export async function connectDB(): Promise<Db> {
  if (database) {
    return database;
  }

  // Load env variables at connection time, not at module load time
  const mongoUri = getRequiredEnv("MONGODB_URI");
  const dbName = getRequiredEnv("DB_NAME");

  client = new MongoClient(mongoUri);

  await client.connect();

  database = client.db(dbName);

  console.log(`✅ MongoDB connected: ${dbName}`);

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
 * Close the MongoDB connection.
 */
export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
    console.log("✅ MongoDB connection closed");
  }
}
