import type { AppPlatform } from "../types/platform.js";
import type { NormalizedApp } from "../types/app.js";
import type { NormalizedReview } from "../types/review.js";

/**
 * Conservative resilience configuration passed to a provider.
 *
 * Values favour reliability over throughput. Concurrency is intentionally
 * NOT part of this interface for the first version — fetching is sequential
 * with a delay between targets.
 */
export interface ProviderResilienceOptions {
  /** Per-request timeout in milliseconds. Scraper default is 30000. */
  timeoutMs?: number;
  /** Number of retries for transient failures. Scraper default is 2. */
  retries?: number;
  /**
   * Maximum number of underlying HTTP requests per second (the scraper's
   * built-in rate limiter uses a 1-second sliding window). Must be a
   * positive number ≤ 50. Lower values are gentler on the store.
   */
  throttle?: number;
}

export type ReviewSort = 1 | 2 | 3;

export interface GetReviewsOptions {
  num?: number;
  sort?: ReviewSort;
  nextPaginationToken?: string;
}

export interface ReviewPage {
  reviews: NormalizedReview[];
  nextPaginationToken?: string;
}

/**
 * Provider adapter interface for a single app store.
 *
 * A provider knows how to fetch and normalize data for ONE platform. The
 * GooglePlayProvider is the only implementation in this phase; an
 * AppStoreProvider for Apple can be added later without touching callers.
 */
export interface AppStoreProvider {
  readonly platform: AppPlatform;
  getApp(appId: string): Promise<NormalizedApp>;
  getReviews(appId: string, options?: GetReviewsOptions): Promise<ReviewPage>;
}
