import type { Db } from "mongodb";

import type { AppPlatform } from "../types/platform.js";
import type { NormalizedReview } from "../types/review.js";
import type {
  AppStoreProvider,
  GetReviewsOptions,
  ReviewSort,
} from "../providers/types.js";

/**
 * Target-driven review synchronization.
 *
 * Reviews are fetched through a provider (never directly from the scraper)
 * and stored keyed on (platform, appId, reviewId). The `raw` store payload is
 * never persisted.
 */

function getDelay(): number {
  const value = Number(process.env.REVIEW_DELAY_MS);

  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  return 2000;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export interface ReviewSyncResult {
  platform: AppPlatform;
  appId: string;
  success: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  error?: string;
}

export interface SyncReviewsOptions {
  num?: number;
  sort?: ReviewSort;
  maxPages?: number;
}

export async function syncReviews(
  db: Db,
  provider: AppStoreProvider,
  appId: string,
  options: SyncReviewsOptions = {},
): Promise<ReviewSyncResult> {
  const { num = 100, sort = 2, maxPages = 1 } = options;
  const platform = provider.platform;

  const normalizedAppId = appId.trim();

  if (!normalizedAppId) {
    return {
      platform,
      appId,
      success: false,
      fetched: 0,
      inserted: 0,
      updated: 0,
      error: "appId cannot be empty",
    };
  }

  let paginationToken: string | undefined;
  let fetched = 0;
  let inserted = 0;
  let updated = 0;

  try {
    console.log(`📝 Syncing reviews: ${platform}:${normalizedAppId}`);

    for (let page = 0; page < maxPages; page++) {
      const getOptions: GetReviewsOptions = { num, sort };

      if (paginationToken !== undefined) {
        getOptions.nextPaginationToken = paginationToken;
      }

      const result = await provider.getReviews(normalizedAppId, getOptions);

      fetched += result.reviews.length;

      const uniqueReviews = deduplicateReviews(result.reviews);

      for (const review of uniqueReviews) {
        const stats = await saveReview(db, review);
        inserted += stats.inserted;
        updated += stats.updated;
      }

      paginationToken = result.nextPaginationToken;

      if (!paginationToken) {
        break;
      }

      await sleep(getDelay());
    }

    console.log(
      `✓ ${normalizedAppId}: ${fetched.toString()} fetched, ` +
        `${inserted.toString()} inserted, ${updated.toString()} updated`,
    );

    return {
      platform,
      appId: normalizedAppId,
      success: true,
      fetched,
      inserted,
      updated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`❌ Reviews failed for ${normalizedAppId}: ${message}`);

    return {
      platform,
      appId: normalizedAppId,
      success: false,
      fetched,
      inserted,
      updated,
      error: message,
    };
  }
}

interface ReviewStats {
  inserted: number;
  updated: number;
}

/**
 * Persist one review, keyed on (platform, appId, reviewId).
 */
async function saveReview(
  db: Db,
  review: NormalizedReview,
): Promise<ReviewStats> {
  if (!review.reviewId) {
    console.warn(
      `⚠️ Skipping review without reviewId for ${review.platform}:${review.appId}`,
    );

    return { inserted: 0, updated: 0 };
  }

  const collection = db.collection("reviews");

  const identity = {
    platform: review.platform,
    appId: review.appId,
    reviewId: review.reviewId,
  };

  const existing = await collection.findOne(identity);

  if (!existing) {
    const now = new Date();
    await collection.insertOne({
      ...review,
      createdAt: now,
      updatedAt: now,
    });

    return { inserted: 1, updated: 0 };
  }

  if (!hasReviewChanged(existing, review)) {
    return { inserted: 0, updated: 0 };
  }

  await collection.updateOne(identity, {
    $set: { ...review, updatedAt: new Date() },
  });

  return { inserted: 0, updated: 1 };
}

/**
 * Compare only meaningful review fields.
 */
function hasReviewChanged(
  existing: Record<string, unknown>,
  incoming: NormalizedReview,
): boolean {
  const fields: Array<keyof NormalizedReview> = [
    "userName",
    "userImage",
    "rating",
    "text",
    "version",
    "thumbsUp",
    "publishedAt",
  ];

  for (const field of fields) {
    const existingValue = existing[field];
    const incomingValue = incoming[field];

    if (existingValue instanceof Date && incomingValue instanceof Date) {
      if (existingValue.getTime() !== incomingValue.getTime()) {
        return true;
      }

      continue;
    }

    if (existingValue instanceof Date && incomingValue !== undefined) {
      const incomingDate = new Date(incomingValue as string | number | Date);

      if (
        !Number.isNaN(incomingDate.getTime()) &&
        existingValue.getTime() !== incomingDate.getTime()
      ) {
        return true;
      }

      continue;
    }

    if (existingValue !== incomingValue) {
      return true;
    }
  }

  return false;
}

/**
 * Remove duplicate reviews returned within the same fetch.
 */
function deduplicateReviews(
  reviews: NormalizedReview[],
): NormalizedReview[] {
  const seen = new Set<string>();
  const result: NormalizedReview[] = [];

  for (const review of reviews) {
    if (!review.reviewId) {
      continue;
    }

    const key = `${review.platform}:${review.appId}:${review.reviewId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(review);
  }

  return result;
}
