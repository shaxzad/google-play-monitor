import type { Db } from "mongodb";

import type { AppPlatform } from "../types/platform.js";
import type { AffiliateTarget } from "../types/affiliate.js";
import {
  addTarget,
  getActiveTargets,
  getTarget,
  listTargets,
  setTargetStatus,
} from "./targets.js";

/**
 * Back-compatibility shim.
 *
 * The concept of a "monitored app" has been superseded by the affiliate
 * target registry (see {@link ./targets}). This module preserves the old
 * function names so any existing caller keeps working, while delegating to
 * the new `affiliate_targets` collection.
 *
 * IMPORTANT behavioural change: removal is now SOFT. `removeMonitoredApp`
 * disables the target (status → "disabled") instead of deleting it, so
 * history is never lost.
 */

const GOOGLE_PLAY: AppPlatform = "google-play";

export interface MonitoredApp {
  packageName: string;
  name?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

function toMonitoredApp(target: AffiliateTarget): MonitoredApp {
  const app: MonitoredApp = {
    packageName: target.appId,
    active: target.status === "active",
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };

  if (target.lastCheckedAt !== undefined) {
    app.lastSyncedAt = target.lastCheckedAt;
  }

  return app;
}

export async function addMonitoredApp(
  db: Db,
  packageName: string,
  name?: string,
): Promise<MonitoredApp> {
  const notes = name !== undefined ? `name: ${name}` : undefined;

  const target = await addTarget(db, {
    appId: packageName,
    platform: GOOGLE_PLAY,
    status: "active",
    ...(notes !== undefined ? { notes } : {}),
  });

  const app = toMonitoredApp(target);

  if (name !== undefined) {
    app.name = name;
  }

  return app;
}

/**
 * Soft removal: disables the target rather than deleting it.
 * Returns true if a target matched.
 */
export function removeMonitoredApp(
  db: Db,
  packageName: string,
): Promise<boolean> {
  return setTargetStatus(db, GOOGLE_PLAY, packageName, "disabled");
}

export function setMonitoredAppStatus(
  db: Db,
  packageName: string,
  active: boolean,
): Promise<boolean> {
  return setTargetStatus(
    db,
    GOOGLE_PLAY,
    packageName,
    active ? "active" : "paused",
  );
}

export async function getMonitoredApps(
  db: Db,
  activeOnly = false,
): Promise<MonitoredApp[]> {
  const targets = activeOnly
    ? await getActiveTargets(db, GOOGLE_PLAY)
    : (await listTargets(db)).filter(
        (target) => target.platform === GOOGLE_PLAY,
      );

  return targets.map(toMonitoredApp);
}

export async function getMonitoredApp(
  db: Db,
  packageName: string,
): Promise<MonitoredApp | null> {
  const target = await getTarget(db, GOOGLE_PLAY, packageName);

  return target ? toMonitoredApp(target) : null;
}
