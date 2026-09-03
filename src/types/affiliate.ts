import type { AppPlatform } from "./platform.js";

/**
 * Country-level GEO code (e.g. "US", "GB").
 *
 * GEO handling is a reusable structure rather than hard-coded countries.
 * These lists capture the commercial/GEO configuration the user supplies.
 * Availability of an app in a country is NOT a legal conclusion about
 * whether affiliate promotion is permitted there.
 */
export type GeoCode = string;

/**
 * Lifecycle status for affiliate entities (operator/program/campaign).
 */
export type EntityStatus = "active" | "inactive";

/**
 * Monitoring status for an affiliate target.
 *
 * - active   : eligible for automatic fetching.
 * - paused   : temporarily excluded from automatic fetching.
 * - disabled : soft-deactivated; excluded from fetching, history retained.
 *
 * Only `active` targets are fetched. Deactivation is always a status
 * change (soft) — targets and their history are never physically deleted.
 */
export type TargetStatus = "active" | "paused" | "disabled";

/**
 * A brand / company that operates one or more apps.
 * Stored in the `operators` collection (never inside an app document).
 */
export interface Operator {
  id: string;
  name: string;
  slug: string;
  website?: string;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * An affiliate program belonging to an operator.
 * Stored in the `affiliate_programs` collection.
 */
export interface AffiliateProgram {
  id: string;
  operatorId: string;
  name: string;
  network?: string;
  website?: string;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A campaign belonging to an affiliate program.
 * Stored in the `affiliate_campaigns` collection.
 *
 * Commission information is optional and must only ever reflect a real,
 * verified relationship — never invented values.
 */
export interface AffiliateCampaign {
  id: string;
  affiliateProgramId: string;
  name: string;
  status: EntityStatus;
  allowedGeos: GeoCode[];
  restrictedGeos: GeoCode[];
  commissionType?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The unit we actually monitor: an explicitly approved application on a
 * platform, optionally linked to affiliate entities.
 *
 * Stored in the `affiliate_targets` collection. An app is only ever
 * fetched because a target for it exists and is `active` — never because
 * it was popular, highly rated, or found via search.
 */
export interface AffiliateTarget {
  id: string;
  platform: AppPlatform;
  appId: string;

  operatorId?: string;
  affiliateProgramId?: string;
  affiliateCampaignId?: string;

  status: TargetStatus;

  allowedGeos: GeoCode[];
  restrictedGeos: GeoCode[];

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt?: Date;
}
