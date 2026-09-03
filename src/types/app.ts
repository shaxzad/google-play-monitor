import type { AppPlatform } from "./platform.js";

/**
 * Where a piece of application data came from.
 *
 * Provenance is stored so we always know the origin and freshness of
 * the data. Values must never be fabricated:
 * - `sourceUrl` is the real store URL for the app.
 * - `fetchedAt` is the moment this data was actually fetched.
 * - `lastVerifiedAt` is only set when the data was re-confirmed.
 */
export interface Provenance {
  source: AppPlatform;
  sourceUrl: string;
  fetchedAt: Date;
  lastVerifiedAt?: Date;
}

/**
 * Normalized application data as produced by a provider.
 *
 * This is the clean internal representation of a store listing. It does
 * NOT contain:
 * - the raw scraper payload (`raw` is no longer stored), or
 * - any affiliate / commercial information (that lives in the separate
 *   affiliate entities, keyed by platform + appId).
 *
 * Identity is always (platform, appId). For Google Play, `appId` equals
 * the Android package name.
 */
export interface NormalizedApp {
  platform: AppPlatform;
  appId: string;

  name?: string;
  summary?: string;
  description?: string;

  developer?: string;
  developerId?: string;
  developerEmail?: string;
  developerWebsite?: string;

  genre?: string;
  categories?: string[];

  score?: number;
  ratings?: number;
  reviews?: number;

  /** Human-readable install bucket, e.g. "1,000,000,000+". */
  installs?: string;
  /** Lower bound of installs as a number, when the store provides it. */
  minInstalls?: number;
  /** Upper bound of installs as a number, when the store provides it. */
  maxInstalls?: number;

  price?: number;
  free?: boolean;
  currency?: string;

  version?: string;
  /** Last store-update time. Stored as a real Date (never a string). */
  updated?: Date;
  /** Human-readable original release date string, when available. */
  released?: string;

  icon?: string;
  screenshots?: string[];

  /** Canonical store URL for the listing. */
  storeUrl?: string;

  contentRating?: string;
  available?: boolean;
  privacyPolicy?: string;

  provenance: Provenance;
}

/**
 * An application document as stored in the `apps` collection.
 *
 * Adds database-managed fields on top of the normalized data:
 * - `id`      : stable app identifier (assigned on first insert).
 * - `packageName`: mirror of `appId` for Google Play kept for backward
 *   compatibility with the existing dashboard and historical data. It is
 *   NOT the identity; uniqueness is enforced on (platform, appId).
 */
export interface AppDocument extends NormalizedApp {
  id: string;
  packageName?: string;
  createdAt: Date;
  updatedAt: Date;
}
