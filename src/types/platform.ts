/**
 * Supported application platforms.
 *
 * "google-play" is the only platform implemented in this phase.
 * "app-store" is intentionally declared so the data model, indexes
 * and provider interface are ready for a future Apple App Store
 * provider WITHOUT another migration. No App Store provider is
 * implemented yet.
 */
export type AppPlatform = "google-play" | "app-store";

/**
 * Canonical identity of an application across every collection.
 *
 * The pair (platform, appId) is the ONLY safe unique identity.
 * Do not assume a bare package name / appId stays unique once a
 * second platform exists.
 */
export interface AppIdentity {
  platform: AppPlatform;
  appId: string;
}

/**
 * Build the canonical MongoDB filter for an application identity.
 *
 * Centralised so every collection keys on the exact same shape.
 */
export function appIdentityFilter(
  platform: AppPlatform,
  appId: string,
): AppIdentity {
  return { platform, appId };
}
