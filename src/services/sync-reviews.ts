import { Db } from "mongodb";

import { scrapeReviews, type ScrapedReview } from "../scraper/reviews.js";

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
  packageName: string;
  success: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  error?: string;
}

export async function syncReviews(
  db: Db,
  packageName: string,
  options: {
    num?: number;
    sort?: 1 | 2 | 3;
    maxPages?: number;
  } = {},
): Promise<ReviewSyncResult> {
  const { num = 100, sort = 2, maxPages = 1 } = options;

  const normalizedPackageName = packageName.trim();

  if (!normalizedPackageName) {
    return {
      packageName,
      success: false,
      fetched: 0,
      inserted: 0,
      updated: 0,
      error: "Package name cannot be empty",
    };
  }

  let paginationToken: string | undefined;

  let fetched = 0;
  let inserted = 0;
  let updated = 0;

  try {
    console.log(`📝 Syncing reviews: ${normalizedPackageName}`);

    for (let page = 0; page < maxPages; page++) {
      const result = await scrapeReviews({
        packageName: normalizedPackageName,

        num,
        sort,

        nextPaginationToken: paginationToken,
      });

      fetched += result.reviews.length;

      /*
       * Prevent processing the same review twice
       * if Google Play returns duplicates.
       */
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
      `✓ ${normalizedPackageName}: ` +
        `${fetched} reviews fetched, ` +
        `${inserted} inserted, ` +
        `${updated} updated`,
    );

    return {
      packageName: normalizedPackageName,

      success: true,

      fetched,
      inserted,
      updated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      `❌ Reviews failed for ` + `${normalizedPackageName}: ${message}`,
    );

    return {
      packageName: normalizedPackageName,

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
 * Saves one review.
 *
 * reviewId is the primary deduplication key.
 */
async function saveReview(db: Db, review: ScrapedReview): Promise<ReviewStats> {
  if (!review.reviewId) {
    console.warn(
      `⚠️ Skipping review without reviewId ` + `for ${review.packageName}`,
    );

    return {
      inserted: 0,
      updated: 0,
    };
  }

  const collection = db.collection("reviews");

  /*
   * Never store raw Google Play response.
   *
   * This keeps the database smaller and avoids
   * duplicate copies of the same information.
   */
  const { raw: _raw, ...cleanReview } = review;

  const existing = await collection.findOne({
    packageName: review.packageName,

    reviewId: review.reviewId,
  });

  if (!existing) {
    await collection.insertOne({
      ...cleanReview,

      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      inserted: 1,
      updated: 0,
    };
  }

  /*
   * Only update if something actually changed.
   */
  const hasChanged = hasReviewChanged(existing, cleanReview);

  if (!hasChanged) {
    return {
      inserted: 0,
      updated: 0,
    };
  }

  await collection.updateOne(
    {
      packageName: review.packageName,

      reviewId: review.reviewId,
    },
    {
      $set: {
        ...cleanReview,
        updatedAt: new Date(),
      },
    },
  );

  return {
    inserted: 0,
    updated: 1,
  };
}

/**
 * Compare only meaningful review fields.
 */
function hasReviewChanged(
  existing: Record<string, unknown>,
  incoming: Omit<ScrapedReview, "raw">,
): boolean {
  const fields: Array<keyof Omit<ScrapedReview, "raw">> = [
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
 * Remove duplicate reviews returned within
 * the same scraping operation.
 */
function deduplicateReviews(reviews: ScrapedReview[]): ScrapedReview[] {
  const seen = new Set<string>();

  const result: ScrapedReview[] = [];

  for (const review of reviews) {
    if (!review.reviewId) {
      continue;
    }

    const key = `${review.packageName}:${review.reviewId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push(review);
  }

  return result;
}
