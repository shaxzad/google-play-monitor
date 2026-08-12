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

  let paginationToken: string | undefined;

  let fetched = 0;
  let inserted = 0;
  let updated = 0;

  try {
    console.log(`📝 Syncing reviews: ${packageName}`);

    for (let page = 0; page < maxPages; page++) {
      const result = await scrapeReviews({
        packageName,
        num,
        sort,
        nextPaginationToken: paginationToken,
      });

      fetched += result.reviews.length;

      for (const review of result.reviews) {
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
      `✓ ${packageName}: ${fetched} reviews fetched, ${inserted} inserted`,
    );

    return {
      packageName,
      success: true,
      fetched,
      inserted,
      updated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`❌ Reviews failed for ${packageName}: ${message}`);

    return {
      packageName,
      success: false,
      fetched,
      inserted,
      updated,
      error: message,
    };
  }
}

async function saveReview(
  db: Db,
  review: ScrapedReview,
): Promise<{
  inserted: number;
  updated: number;
}> {
  if (!review.reviewId) {
    console.warn(
      `⚠️ Skipping review without reviewId for ${review.packageName}`,
    );

    return {
      inserted: 0,
      updated: 0,
    };
  }

  const existing = await db.collection("reviews").findOne({
    packageName: review.packageName,

    reviewId: review.reviewId,
  });

  const document = {
    ...review,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.collection("reviews").updateOne(
      {
        packageName: review.packageName,

        reviewId: review.reviewId,
      },
      {
        $set: document,
      },
    );

    return {
      inserted: 0,
      updated: 1,
    };
  }

  await db.collection("reviews").insertOne({
    ...document,
    createdAt: new Date(),
  });

  return {
    inserted: 1,
    updated: 0,
  };
}
