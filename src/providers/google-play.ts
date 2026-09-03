import {
  app as fetchGooglePlayApp,
  reviews as fetchGooglePlayReviews,
  BlockedError,
  NotFoundError,
  RateLimitError,
  type AppOptions,
  type OnRetry,
  type RetryEvent,
  type ReviewsOptions,
} from "@mradex77/google-play-scraper";

import type { AppPlatform } from "../types/platform.js";
import type { NormalizedApp } from "../types/app.js";
import { normalizeApp } from "../scraper/apps.js";
import { normalizeReviewsResult } from "../scraper/reviews.js";
import type {
  AppStoreProvider,
  GetReviewsOptions,
  ProviderResilienceOptions,
  ReviewPage,
} from "./types.js";

/**
 * Google Play adapter implementing the platform-agnostic {@link AppStoreProvider}.
 *
 * Responsibilities:
 * - Perform the network fetch via `@mradex77/google-play-scraper`.
 * - Apply conservative resilience settings (timeout, retries, throttle).
 * - Delegate ALL shaping of data to the pure normalizers
 *   ({@link normalizeApp}, {@link normalizeReviewsResult}) so this file stays
 *   thin and the normalizers remain unit-testable without the network.
 *
 * The scraper's typed errors (NotFoundError, RateLimitError, BlockedError,
 * ...) are allowed to propagate unchanged so the sync layer can decide how to
 * react per target. A failure here concerns exactly one target; isolation
 * across targets is the caller's responsibility.
 */

const GOOGLE_PLAY: AppPlatform = "google-play";

/** Conservative defaults that favour reliability over throughput. */
const DEFAULT_LANG = "en";
const DEFAULT_COUNTRY = "us";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_THROTTLE = 5; // <= 5 requests/second
const DEFAULT_REVIEW_COUNT = 100;

export interface GooglePlayProviderOptions {
  /** Store language, e.g. "en". */
  lang?: string;
  /** Store country, e.g. "us". */
  country?: string;
  /** Resilience knobs forwarded to the scraper. */
  resilience?: ProviderResilienceOptions;
  /**
   * Optional hook invoked whenever the scraper retries a request. Useful for
   * observability; kept side-effect free by default.
   */
  onRetry?: OnRetry;
}

export class GooglePlayProvider implements AppStoreProvider {
  readonly platform: AppPlatform = GOOGLE_PLAY;

  private readonly lang: string;
  private readonly country: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly throttle: number;
  private readonly onRetry: OnRetry;

  constructor(options: GooglePlayProviderOptions = {}) {
    this.lang = options.lang ?? DEFAULT_LANG;
    this.country = options.country ?? DEFAULT_COUNTRY;

    const resilience = options.resilience ?? {};
    this.timeoutMs = resilience.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = resilience.retries ?? DEFAULT_RETRIES;
    this.throttle = resilience.throttle ?? DEFAULT_THROTTLE;

    this.onRetry =
      options.onRetry ??
      ((event: RetryEvent): void => {
        // Default hook: quiet, structured breadcrumb. No secrets are logged.
        console.warn(
          `  ↻ retry attempt ${event.attempt.toString()} after ${event.delayMs.toString()}ms (${event.reason})`,
        );
      });
  }

  /**
   * Fetch and normalize a single app by its store-specific id (packageName).
   * Throws the scraper's typed errors on failure.
   */
  async getApp(appId: string): Promise<NormalizedApp> {
    const fetchedAt = new Date();

    const options: AppOptions = {
      appId,
      lang: this.lang,
      country: this.country,
      throttle: this.throttle,
      requestOptions: {
        timeoutMs: this.timeoutMs,
        retries: this.retries,
        onRetry: this.onRetry,
      },
    };

    const raw = await fetchGooglePlayApp(options);

    return normalizeApp(raw, {
      appId,
      fetchedAt,
      platform: this.platform,
    });
  }

  /**
   * Fetch and normalize a single page of reviews for an app.
   * Throws the scraper's typed errors on failure.
   */
  async getReviews(
    appId: string,
    options: GetReviewsOptions = {},
  ): Promise<ReviewPage> {
    const reviewsOptions: ReviewsOptions = {
      appId,
      lang: this.lang,
      country: this.country,
      throttle: this.throttle,
      num: options.num ?? DEFAULT_REVIEW_COUNT,
      requestOptions: {
        timeoutMs: this.timeoutMs,
        retries: this.retries,
        onRetry: this.onRetry,
      },
    };

    if (options.sort !== undefined) {
      reviewsOptions.sort = options.sort;
    }

    if (options.nextPaginationToken !== undefined) {
      reviewsOptions.nextPaginationToken = options.nextPaginationToken;
    }

    const raw = await fetchGooglePlayReviews(reviewsOptions);

    const { reviews, nextPaginationToken } = normalizeReviewsResult(raw, {
      appId,
      platform: this.platform,
    });

    const page: ReviewPage = { reviews };

    if (nextPaginationToken !== undefined) {
      page.nextPaginationToken = nextPaginationToken;
    }

    return page;
  }
}

/**
 * Type guards for the scraper's typed errors, re-exported so the sync layer
 * can branch on failure kind without importing the scraper directly.
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isBlockedError(error: unknown): error is BlockedError {
  return error instanceof BlockedError;
}
