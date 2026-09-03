import type { Db } from "mongodb";

import type { AppPlatform } from "../types/platform.js";
import type {
  AffiliateTarget,
  GeoCode,
  TargetStatus,
} from "../types/affiliate.js";
import type { AppStoreProvider } from "../providers/types.js";

/**
 * Affiliate target registry.
 *
 * A "target" is the ONLY reason an app is fetched. The sync layer reads
 * ACTIVE targets from here — it must never derive the fetch list from the
 * `apps` collection or from search/discovery results.
 *
 * Identity is (platform, appId); a deterministic string `id` mirrors that
 * pair so callers can reference a target by a single key.
 *
 * Soft deactivation only: targets are never physically deleted. `disabled`
 * and `paused` exclude a target from fetching while preserving its history.
 */

const COLLECTION = "affiliate_targets";
const GOOGLE_PLAY: AppPlatform = "google-play";

/** Deterministic id for a target: "<platform>:<appId>". */
export function targetId(platform: AppPlatform, appId: string): string {
  return `${platform}:${appId}`;
}

function collection(db: Db) {
  return db.collection<AffiliateTarget>(COLLECTION);
}

export interface AddTargetInput {
  appId: string;
  platform?: AppPlatform;
  operatorId?: string;
  affiliateProgramId?: string;
  affiliateCampaignId?: string;
  status?: TargetStatus;
  allowedGeos?: GeoCode[];
  restrictedGeos?: GeoCode[];
  notes?: string;
}

/** Validate the syntax required by a Google Play package/app ID. */
export function validateGooglePlayAppId(appId: string): string {
  const normalizedAppId = appId.trim();
  const packagePattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

  if (!packagePattern.test(normalizedAppId)) {
    throw new Error(
      `Invalid Google Play package ID "${appId}". Use the package ID after id= in the Google Play Store URL, for example com.example.app.`,
    );
  }

  return normalizedAppId;
}

/** Confirm that Google Play has the package before it enters the registry. */
export async function validateGooglePlayTarget(
  provider: AppStoreProvider,
  appId: string,
): Promise<void> {
  if (provider.platform !== GOOGLE_PLAY) {
    throw new Error(
      `Expected a Google Play provider, got ${provider.platform}`,
    );
  }

  await provider.getApp(validateGooglePlayAppId(appId));
}

/** Validate through the provider, then create/update the approved target. */
export async function addValidatedGooglePlayTarget(
  db: Db,
  provider: AppStoreProvider,
  input: AddTargetInput,
): Promise<AffiliateTarget> {
  const appId = validateGooglePlayAppId(input.appId);
  await validateGooglePlayTarget(provider, appId);
  return addTarget(db, { ...input, appId, platform: GOOGLE_PLAY });
}

/**
 * Add a target, or update the editable fields of an existing one
 * (idempotent upsert keyed on platform+appId). Never deletes.
 *
 * A newly added target defaults to `active` unless a status is supplied.
 * Re-adding an existing target does NOT silently reactivate it: status is
 * only changed when explicitly provided.
 */
export async function addTarget(
  db: Db,
  input: AddTargetInput,
): Promise<AffiliateTarget> {
  const platform = input.platform ?? GOOGLE_PLAY;
  const appId = input.appId.trim();

  if (!appId) {
    throw new Error("appId cannot be empty");
  }

  const now = new Date();
  const id = targetId(platform, appId);

  const set: Partial<AffiliateTarget> = {
    platform,
    appId,
    updatedAt: now,
    allowedGeos: input.allowedGeos ?? [],
    restrictedGeos: input.restrictedGeos ?? [],
  };

  if (input.operatorId !== undefined) set.operatorId = input.operatorId;
  if (input.affiliateProgramId !== undefined)
    set.affiliateProgramId = input.affiliateProgramId;
  if (input.affiliateCampaignId !== undefined)
    set.affiliateCampaignId = input.affiliateCampaignId;
  if (input.notes !== undefined) set.notes = input.notes;
  if (input.status !== undefined) set.status = input.status;

  const setOnInsert: Partial<AffiliateTarget> = {
    id,
    createdAt: now,
  };

  // Only default the status on insert if it wasn't explicitly provided,
  // so re-adding never silently flips a paused/disabled target back on.
  if (input.status === undefined) {
    setOnInsert.status = "active";
  }

  const result = await collection(db).findOneAndUpdate(
    { platform, appId },
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) {
    throw new Error(`Failed to add target: ${id}`);
  }

  return result;
}

/**
 * Change a target's status. Used for soft deactivation.
 * Returns true if a target matched.
 */
export async function setTargetStatus(
  db: Db,
  platform: AppPlatform,
  appId: string,
  status: TargetStatus,
): Promise<boolean> {
  const result = await collection(db).updateOne(
    { platform, appId },
    { $set: { status, updatedAt: new Date() } },
  );

  return result.matchedCount > 0;
}

/** Convenience wrappers for the three lifecycle transitions. */
export function pauseTarget(
  db: Db,
  platform: AppPlatform,
  appId: string,
): Promise<boolean> {
  return setTargetStatus(db, platform, appId, "paused");
}

export function disableTarget(
  db: Db,
  platform: AppPlatform,
  appId: string,
): Promise<boolean> {
  return setTargetStatus(db, platform, appId, "disabled");
}

export function activateTarget(
  db: Db,
  platform: AppPlatform,
  appId: string,
): Promise<boolean> {
  return setTargetStatus(db, platform, appId, "active");
}

/**
 * Record that a target was checked (fetched). Best-effort; does not throw.
 */
export async function markTargetChecked(
  db: Db,
  platform: AppPlatform,
  appId: string,
  when: Date = new Date(),
): Promise<void> {
  await collection(db).updateOne(
    { platform, appId },
    { $set: { lastCheckedAt: when, updatedAt: when } },
  );
}

/** Fetch a single target by identity. */
export function getTarget(
  db: Db,
  platform: AppPlatform,
  appId: string,
): Promise<AffiliateTarget | null> {
  return collection(db).findOne({ platform, appId });
}

/** List all targets (any status), sorted by identity. */
export function listTargets(db: Db): Promise<AffiliateTarget[]> {
  return collection(db).find({}).sort({ platform: 1, appId: 1 }).toArray();
}

/**
 * The active fetch list. THIS is what the sync layer consumes — only
 * `status: "active"` targets are ever fetched.
 */
export function getActiveTargets(
  db: Db,
  platform?: AppPlatform,
): Promise<AffiliateTarget[]> {
  const filter: Record<string, unknown> = { status: "active" };

  if (platform !== undefined) {
    filter.platform = platform;
  }

  return collection(db).find(filter).sort({ platform: 1, appId: 1 }).toArray();
}
