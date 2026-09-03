import type { Db } from "mongodb";

import type { AppPlatform } from "../types/platform.js";

/**
 * Candidate staging.
 *
 * Discovery (search) produces CANDIDATES, not targets. A candidate is a
 * lead recorded for human review; it is NEVER fetched and NEVER promoted to
 * an active target automatically. Promotion to an affiliate target is an
 * explicit, separate action (see targets.addTarget).
 *
 * This replaces the previous behaviour where discovery wrote full app
 * documents (with an embedded affiliate blob) straight into `apps`.
 */

const COLLECTION = "app_candidates";
const GOOGLE_PLAY: AppPlatform = "google-play";

export type CandidateStatus = "new" | "reviewed" | "promoted" | "rejected";

export interface DiscoverySighting {
  query: string;
  rank: number;
  discoveredAt: Date;
}

export interface AppCandidate {
  platform: AppPlatform;
  appId: string;

  title?: string;
  developer?: string;

  /** Every search that surfaced this candidate, for later triage. */
  sightings: DiscoverySighting[];

  status: CandidateStatus;

  firstDiscoveredAt: Date;
  lastDiscoveredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function collection(db: Db) {
  return db.collection<AppCandidate>(COLLECTION);
}

export interface RecordCandidateInput {
  appId: string;
  platform?: AppPlatform;
  title?: string;
  developer?: string;
  sighting: DiscoverySighting;
}

/**
 * Record (or update) a discovery candidate.
 *
 * - Never writes to `apps`.
 * - Never sets an active status; new candidates start as `new`.
 * - Appends the sighting and refreshes lightweight display fields.
 *
 * A candidate that has already been triaged (reviewed/promoted/rejected)
 * keeps its status; only its sightings and timestamps are updated.
 */
export async function recordCandidate(
  db: Db,
  input: RecordCandidateInput,
): Promise<void> {
  const platform = input.platform ?? GOOGLE_PLAY;
  const appId = input.appId.trim();

  if (!appId) {
    return;
  }

  const now = new Date();

  const set: Partial<AppCandidate> = {
    platform,
    appId,
    lastDiscoveredAt: input.sighting.discoveredAt,
    updatedAt: now,
  };

  if (input.title !== undefined) set.title = input.title;
  if (input.developer !== undefined) set.developer = input.developer;

  await collection(db).updateOne(
    { platform, appId },
    {
      $set: set,
      $setOnInsert: {
        status: "new",
        firstDiscoveredAt: input.sighting.discoveredAt,
        createdAt: now,
      },
      $push: { sightings: input.sighting },
    },
    { upsert: true },
  );
}

export function listCandidates(
  db: Db,
  status?: CandidateStatus,
): Promise<AppCandidate[]> {
  const filter = status !== undefined ? { status } : {};

  return collection(db)
    .find(filter)
    .sort({ lastDiscoveredAt: -1 })
    .toArray();
}

/**
 * Mark a candidate's triage status (e.g. after a human promotes or rejects
 * it). Promotion to an actual target is done separately and explicitly.
 */
export async function setCandidateStatus(
  db: Db,
  platform: AppPlatform,
  appId: string,
  status: CandidateStatus,
): Promise<boolean> {
  const result = await collection(db).updateOne(
    { platform, appId },
    { $set: { status, updatedAt: new Date() } },
  );

  return result.matchedCount > 0;
}
