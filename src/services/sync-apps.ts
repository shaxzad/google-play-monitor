import type { Db } from "mongodb";

import type { AppPlatform } from "../types/platform.js";
import type { NormalizedApp, AppDocument } from "../types/app.js";
import type { AffiliateTarget } from "../types/affiliate.js";
import type { AppStoreProvider } from "../providers/types.js";
import { getActiveTargets, markTargetChecked } from "./targets.js";
import { createAppSnapshot } from "./snapshots.js";

/**
 * Target-driven app synchronization.
 *
 * The set of apps to fetch comes EXCLUSIVELY from ACTIVE affiliate targets
 * (see {@link getActiveTargets}). This module never queries the `apps`
 * collection to decide what to fetch — that would resurrect the
 * "sync everything we've ever seen" anti-pattern.
 *
 * A failure fetching one target is isolated: it is recorded and the loop
 * continues with the next target. Only a successful fetch writes to `apps`
 * and appends a snapshot.
 */

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
  platform: AppPlatform;
  appId: string;
  success: boolean;
  title?: string;
  snapshotCreated?: boolean;
  error?: string;
}

/**
 * Fetch, persist, and snapshot a single app for a given target.
 * Never throws — failures are returned as `success: false`.
 */
export async function syncTarget(
  db: Db,
  provider: AppStoreProvider,
  target: AffiliateTarget,
): Promise<SyncResult> {
  const { platform, appId } = target;

  try {
    console.log(`🔍 Fetching ${platform}:${appId}...`);

    const app = await provider.getApp(appId);

    await saveApp(db, app);

    const scrapedAt = app.provenance.fetchedAt;
    const snapshotCreated = await createAppSnapshot(db, app, scrapedAt);

    await markTargetChecked(db, platform, appId, scrapedAt);

    console.log(`✓ ${app.name ?? appId} saved`);

    const result: SyncResult = {
      platform,
      appId,
      success: true,
      snapshotCreated,
    };

    if (app.name !== undefined) {
      result.title = app.name;
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`❌ ${platform}:${appId}: ${message}`);

    return {
      platform,
      appId,
      success: false,
      error: message,
    };
  }
}

/**
 * Sync every ACTIVE target for the provider's platform, sequentially, with a
 * configurable delay between requests.
 */
export async function syncActiveTargets(
  db: Db,
  provider: AppStoreProvider,
): Promise<SyncResult[]> {
  const targets = await getActiveTargets(db, provider.platform);

  console.log(`\n📱 Found ${targets.length.toString()} active targets\n`);

  const results: SyncResult[] = [];

  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];

    console.log(`[${(index + 1).toString()}/${targets.length.toString()}]`);

    const result = await syncTarget(db, provider, target);

    results.push(result);

    if (index < targets.length - 1) {
      await sleep(getDelay());
    }
  }

  return results;
}

/**
 * Upsert the latest app state keyed on (platform, appId). No `raw` payload is
 * ever written. `packageName` is mirrored for back-compat but is NOT the
 * identity.
 */
async function saveApp(db: Db, app: NormalizedApp): Promise<void> {
  const now = new Date();

  const document: Omit<AppDocument, "id" | "createdAt"> & {
    packageName: string;
  } = {
    ...app,
    packageName: app.appId,
    updatedAt: now,
  };

  await db.collection<AppDocument>("apps").updateOne(
    { platform: app.platform, appId: app.appId },
    {
      $set: document,
      $setOnInsert: {
        id: `${app.platform}:${app.appId}`,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}
