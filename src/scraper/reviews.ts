import type { AppPlatform } from "../types/platform.js";
import type { NormalizedReview } from "../types/review.js";

/**
 * Pure normalization for Google Play reviews.
 *
 * Like the app normalizer, this module has no dependency on the scraper
 * library or the database. The provider fetches the raw payload and calls
 * these functions.
 */

const GOOGLE_PLAY: AppPlatform = "google-play";

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function normalizeReviewDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

export interface NormalizeReviewOptions {
  appId: string;
  platform?: AppPlatform;
}

/**
 * Normalize a single raw review object.
 */
export function normalizeReview(
  raw: unknown,
  options: NormalizeReviewOptions,
): NormalizedReview {
  const review =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const normalized: NormalizedReview = {
    platform: options.platform ?? GOOGLE_PLAY,
    appId: options.appId,

    reviewId: normalizeString(review.id),
    userName: normalizeString(review.userName),
    userImage: normalizeString(review.userImage),
    rating: normalizeNumber(review.score),
    text: normalizeString(review.text),
    version: normalizeString(review.version),
    thumbsUp: normalizeNumber(review.thumbsUp),
    publishedAt: normalizeReviewDate(review.date),
  };

  return normalized;
}

/**
 * Normalize the raw result returned by the scraper's `reviews()` call into a
 * clean page of reviews plus an optional pagination token.
 */
export function normalizeReviewsResult(
  raw: unknown,
  options: NormalizeReviewOptions,
): { reviews: NormalizedReview[]; nextPaginationToken?: string } {
  const result =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const rawReviews = Array.isArray(result.data) ? result.data : [];

  const reviews = rawReviews.map((item) => normalizeReview(item, options));

  const token = result.nextPaginationToken;

  return {
    reviews,
    nextPaginationToken: typeof token === "string" ? token : undefined,
  };
}
