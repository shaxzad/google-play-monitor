import type { Db } from "mongodb";

import type {
  AffiliateCampaign,
  AffiliateProgram,
  EntityStatus,
  GeoCode,
  Operator,
} from "../types/affiliate.js";

/**
 * Affiliate entity registry: operators, programs, and campaigns.
 *
 * These live in their OWN collections and are never embedded inside an app
 * document. They describe commercial relationships and must only ever hold
 * real, verified information — this module never invents programs, networks,
 * or commission values.
 *
 * All writes are idempotent upserts keyed on the entity's `id`. Nothing here
 * deletes data; deactivation is a status change.
 */

const OPERATORS = "operators";
const PROGRAMS = "affiliate_programs";
const CAMPAIGNS = "affiliate_campaigns";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ---------------------------------------------------------------- Operators */

export interface UpsertOperatorInput {
  id: string;
  name: string;
  slug?: string;
  website?: string;
  status?: EntityStatus;
}

export async function upsertOperator(
  db: Db,
  input: UpsertOperatorInput,
): Promise<Operator> {
  const now = new Date();
  const collection = db.collection<Operator>(OPERATORS);

  const set: Partial<Operator> = {
    name: input.name,
    slug: input.slug ?? slugify(input.name),
    status: input.status ?? "active",
    updatedAt: now,
  };

  if (input.website !== undefined) set.website = input.website;

  const result = await collection.findOneAndUpdate(
    { id: input.id },
    { $set: set, $setOnInsert: { id: input.id, createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) {
    throw new Error(`Failed to upsert operator: ${input.id}`);
  }

  return result;
}

export function getOperator(db: Db, id: string): Promise<Operator | null> {
  return db.collection<Operator>(OPERATORS).findOne({ id });
}

export function listOperators(db: Db): Promise<Operator[]> {
  return db.collection<Operator>(OPERATORS).find({}).sort({ name: 1 }).toArray();
}

/* ----------------------------------------------------------------- Programs */

export interface UpsertProgramInput {
  id: string;
  operatorId: string;
  name: string;
  network?: string;
  website?: string;
  status?: EntityStatus;
}

export async function upsertAffiliateProgram(
  db: Db,
  input: UpsertProgramInput,
): Promise<AffiliateProgram> {
  const now = new Date();
  const collection = db.collection<AffiliateProgram>(PROGRAMS);

  const set: Partial<AffiliateProgram> = {
    operatorId: input.operatorId,
    name: input.name,
    status: input.status ?? "active",
    updatedAt: now,
  };

  if (input.network !== undefined) set.network = input.network;
  if (input.website !== undefined) set.website = input.website;

  const result = await collection.findOneAndUpdate(
    { id: input.id },
    { $set: set, $setOnInsert: { id: input.id, createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) {
    throw new Error(`Failed to upsert affiliate program: ${input.id}`);
  }

  return result;
}

export function listAffiliatePrograms(
  db: Db,
  operatorId?: string,
): Promise<AffiliateProgram[]> {
  const filter = operatorId !== undefined ? { operatorId } : {};

  return db
    .collection<AffiliateProgram>(PROGRAMS)
    .find(filter)
    .sort({ name: 1 })
    .toArray();
}

/* ---------------------------------------------------------------- Campaigns */

export interface UpsertCampaignInput {
  id: string;
  affiliateProgramId: string;
  name: string;
  status?: EntityStatus;
  allowedGeos?: GeoCode[];
  restrictedGeos?: GeoCode[];
  commissionType?: string;
  notes?: string;
}

export async function upsertAffiliateCampaign(
  db: Db,
  input: UpsertCampaignInput,
): Promise<AffiliateCampaign> {
  const now = new Date();
  const collection = db.collection<AffiliateCampaign>(CAMPAIGNS);

  const set: Partial<AffiliateCampaign> = {
    affiliateProgramId: input.affiliateProgramId,
    name: input.name,
    status: input.status ?? "active",
    allowedGeos: input.allowedGeos ?? [],
    restrictedGeos: input.restrictedGeos ?? [],
    updatedAt: now,
  };

  if (input.commissionType !== undefined)
    set.commissionType = input.commissionType;
  if (input.notes !== undefined) set.notes = input.notes;

  const result = await collection.findOneAndUpdate(
    { id: input.id },
    { $set: set, $setOnInsert: { id: input.id, createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) {
    throw new Error(`Failed to upsert affiliate campaign: ${input.id}`);
  }

  return result;
}

export function listAffiliateCampaigns(
  db: Db,
  affiliateProgramId?: string,
): Promise<AffiliateCampaign[]> {
  const filter =
    affiliateProgramId !== undefined ? { affiliateProgramId } : {};

  return db
    .collection<AffiliateCampaign>(CAMPAIGNS)
    .find(filter)
    .sort({ name: 1 })
    .toArray();
}
