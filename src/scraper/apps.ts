import type { AppPlatform } from "../types/platform.js";
import type { NormalizedApp, Provenance } from "../types/app.js";

/**
 * Pure normalization for Google Play application data.
 *
 * This module intentionally has NO dependency on the scraper library or the
 * database so it can be unit-tested in isolation. The provider
 * (src/providers/google-play.ts) performs the network fetch and then calls
 * {@link normalizeApp} with the raw payload.
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

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );

  return items.length > 0 ? items : undefined;
}

/**
 * Extract category names from the scraper's `categories` array
 * (`Array<{ name: string; id: string | null }>`).
 */
function normalizeCategories(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const names: string[] = [];

  for (const entry of value) {
    if (entry && typeof entry === "object" && "name" in entry) {
      const name = normalizeString((entry as { name: unknown }).name);

      if (name) {
        names.push(name);
      }
    } else {
      const name = normalizeString(entry);

      if (name) {
        names.push(name);
      }
    }
  }

  return names.length > 0 ? names : undefined;
}

/**
 * Convert the Google Play `updated` value into a Date.
 *
 * The scraper returns `updated` as a number of milliseconds since the Unix
 * epoch (its mapper multiplies the raw seconds value by 1000). The previous
 * code ran it through string normalization, which silently dropped it. We
 * convert the numeric timestamp directly — never via string parsing.
 */
export function epochMsToDate(value: unknown): Date | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  // Defensive fallback: a real Date passed straight through.
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  return undefined;
}

/**
 * Build the canonical Google Play store URL for an app.
 * Deterministic — not fabricated data.
 */
export function googlePlayStoreUrl(appId: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(
    appId,
  )}`;
}

export interface NormalizeAppOptions {
  appId: string;
  fetchedAt: Date;
  platform?: AppPlatform;
}

/**
 * Normalize a raw Google Play app payload into a {@link NormalizedApp}.
 *
 * - Identity is (platform, appId).
 * - `updated` becomes a real Date.
 * - No `raw` payload and no affiliate information are included.
 * - Provenance records the real store URL and the fetch time.
 */
export function normalizeApp(
  raw: unknown,
  options: NormalizeAppOptions,
): NormalizedApp {
  const appId = options.appId.trim();

  if (!appId) {
    throw new Error("appId cannot be empty");
  }

  const platform = options.platform ?? GOOGLE_PLAY;

  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const storeUrl = normalizeString(data.url) ?? googlePlayStoreUrl(appId);

  const provenance: Provenance = {
    source: platform,
    sourceUrl: storeUrl,
    fetchedAt: options.fetchedAt,
  };

  const normalized: NormalizedApp = {
    platform,
    appId,

    name: normalizeString(data.title),
    summary: normalizeString(data.summary),
    description: normalizeString(data.description),

    developer: normalizeString(data.developer),
    developerId: normalizeString(data.developerId),
    developerEmail: normalizeString(data.developerEmail),
    developerWebsite: normalizeString(data.developerWebsite),

    genre: normalizeString(data.genre),
    categories: normalizeCategories(data.categories),

    score: normalizeNumber(data.score),
    ratings: normalizeNumber(data.ratings),
    reviews: normalizeNumber(data.reviews),

    installs: normalizeString(data.installs),
    minInstalls: normalizeNumber(data.minInstalls),
    maxInstalls: normalizeNumber(data.maxInstalls),

    price: normalizeNumber(data.price),
    free: normalizeBoolean(data.free),
    currency: normalizeString(data.currency),

    version: normalizeString(data.version),
    updated: epochMsToDate(data.updated),
    released: normalizeString(data.released),

    icon: normalizeString(data.icon),
    screenshots: normalizeStringArray(data.screenshots),

    storeUrl,

    contentRating: normalizeString(data.contentRating),
    available: normalizeBoolean(data.available),
    privacyPolicy: normalizeString(data.privacyPolicy),

    provenance,
  };

  // Drop keys whose value is undefined so we never persist `undefined`.
  return stripUndefined(normalized);
}

/**
 * Remove keys with `undefined` values (keeps the stored document clean).
 * `provenance` is preserved as an object with its own defined fields.
 */
function stripUndefined(app: NormalizedApp): NormalizedApp {
  const entries = Object.entries(app).filter(
    ([, value]) => value !== undefined,
  );

  return Object.fromEntries(entries) as unknown as NormalizedApp;
}
