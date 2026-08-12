import { Db } from "mongodb";

import { scrapeApp, type ScrapedApp } from "../scraper/apps.js";

import { createAppSnapshot } from "./snapshots.js";

function getDelay(): number {
  const value = Number(process.env.SCRAPE_DELAY_MS);

  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  return 1500;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export interface SyncResult {
  packageName: string;
  success: boolean;
  title?: string;
  error?: string;
}

/**
 * Get all package names currently stored in MongoDB.
 *
 * MongoDB is the source of truth.
 */
export async function getPackageNames(db: Db): Promise<string[]> {
  const apps = await db
    .collection<{ packageName?: string }>("apps")
    .find(
      {
        packageName: {
          $exists: true,
          $type: "string",
        },
      },
      {
        projection: {
          packageName: 1,
          _id: 0,
        },
      },
    )
    .toArray();

  return Array.from(
    new Set(
      apps
        .map((app) => app.packageName?.trim())
        .filter((packageName): packageName is string => Boolean(packageName)),
    ),
  );
}

export async function syncApp(
  db: Db,
  packageName: string,
): Promise<SyncResult> {
  try {
    console.log(`🔍 Fetching ${packageName}...`);

    const app = await scrapeApp(packageName);

    await saveApp(db, app);

    await createAppSnapshot(db, app);

    console.log(`✓ ${app.title || packageName} saved`);

    return {
      packageName,
      success: true,
      title: app.title,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`❌ ${packageName}: ${message}`);

    return {
      packageName,
      success: false,
      error: message,
    };
  }
}

export async function syncApps(
  db: Db,
  packageNames?: string[],
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  /**
   * If packageNames are provided, use them.
   *
   * Otherwise read directly from MongoDB.
   */
  const packages =
    packageNames && packageNames.length > 0
      ? packageNames
      : await getPackageNames(db);

  const uniquePackages = Array.from(
    new Set(packages.map((item) => item.trim()).filter(Boolean)),
  );

  console.log(`\n📱 Found ${uniquePackages.length} apps\n`);

  for (let index = 0; index < uniquePackages.length; index++) {
    const packageName = uniquePackages[index];

    console.log(`[${index + 1}/${uniquePackages.length}]`);

    const result = await syncApp(db, packageName);

    results.push(result);

    if (index < uniquePackages.length - 1) {
      await sleep(getDelay());
    }
  }

  return results;
}

async function saveApp(db: Db, app: ScrapedApp): Promise<void> {
  const now = new Date();

  await db.collection("apps").updateOne(
    {
      packageName: app.packageName,
    },
    {
      $set: {
        ...app,
        updatedAt: now,
      },

      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
    },
  );
}
