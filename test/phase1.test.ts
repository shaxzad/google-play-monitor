import assert from "node:assert/strict";
import test from "node:test";

import { epochMsToDate, normalizeApp } from "../src/scraper/apps.js";
import { syncActiveTargets } from "../src/services/sync-apps.js";
import {
  addValidatedGooglePlayTarget,
  getActiveTargets,
  setTargetStatus,
  validateGooglePlayAppId,
  validateGooglePlayTarget,
} from "../src/services/targets.js";
import type { AppPlatform } from "../src/types/platform.js";

test("converts the numeric Google Play updated timestamp to a Date", () => {
  const updated = epochMsToDate(1_700_000_000_000);

  assert.ok(updated instanceof Date);
  if (!updated) throw new Error("expected a valid Date");
  assert.equal(updated.getTime(), 1_700_000_000_000);
  assert.equal(typeof updated.getTime(), "number");
});

test("normalized apps use platform plus appId and no affiliate blob", () => {
  const app = normalizeApp(
    {
      appId: "ignored-by-explicit-identity",
      title: "Example",
      updated: 1_700_000_000_000,
      affiliate: { program: "must not be persisted" },
    },
    { appId: "com.example.app", fetchedAt: new Date("2026-01-01") },
  );

  assert.equal(app.platform, "google-play");
  assert.equal(app.appId, "com.example.app");
  assert.equal(app.updated?.getTime(), 1_700_000_000_000);
  assert.equal("affiliate" in app, false);
  assert.equal("raw" in app, false);
  assert.equal(
    app.provenance.sourceUrl,
    "https://play.google.com/store/apps/details?id=com.example.app",
  );
});

test("accepts a package ID and rejects a display name", () => {
  assert.equal(validateGooglePlayAppId(" com.example.app "), "com.example.app");
  assert.throws(
    () => validateGooglePlayAppId("VideoPoker.com"),
    /Invalid Google Play package ID/,
  );
});

test("validates a package through the provider", async () => {
  let fetches = 0;
  const provider = {
    platform: "google-play" as const,
    getApp: async (appId: string) => {
      fetches++;
      return normalizeApp(
        { title: "Example" },
        { appId, fetchedAt: new Date() },
      );
    },
    getReviews: async () => ({ reviews: [] }),
  };

  await validateGooglePlayTarget(provider, "com.example.app");
  assert.equal(fetches, 1);
});

test("provider failure does not create a target", async () => {
  let databaseTouched = false;
  const provider = {
    platform: "google-play" as const,
    getApp: async () => {
      throw new Error("NotFoundError: app not found");
    },
    getReviews: async () => ({ reviews: [] }),
  };
  const db = {
    collection: () => {
      databaseTouched = true;
      throw new Error("target collection must not be touched");
    },
  } as any;

  await assert.rejects(
    () =>
      addValidatedGooglePlayTarget(db, provider, {
        appId: "com.missing.app",
      }),
    /NotFoundError/,
  );
  assert.equal(databaseTouched, false);
});

test("only active targets are returned for a platform", async () => {
  const targets = [
    { platform: "google-play", appId: "active", status: "active" },
    { platform: "google-play", appId: "paused", status: "paused" },
    { platform: "google-play", appId: "disabled", status: "disabled" },
    { platform: "app-store", appId: "other-platform", status: "active" },
  ];

  const db = {
    collection: () => ({
      find: (filter: Record<string, unknown>) => ({
        sort: () => ({
          toArray: async () =>
            targets.filter(
              (target) =>
                target.status === filter.status &&
                target.platform === filter.platform,
            ),
        }),
      }),
    }),
  } as any;

  const active = await getActiveTargets(db, "google-play" as AppPlatform);

  assert.deepEqual(
    active.map((target) => target.appId),
    ["active"],
  );
});

test("a failed target does not stop the remaining active targets", async () => {
  const targets = [
    {
      id: "google-play:first",
      platform: "google-play",
      appId: "first",
      status: "active",
      allowedGeos: [],
      restrictedGeos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "google-play:second",
      platform: "google-play",
      appId: "second",
      status: "active",
      allowedGeos: [],
      restrictedGeos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const fetched: string[] = [];
  const db = {
    collection: (name: string) => {
      if (name === "affiliate_targets") {
        return {
          find: () => ({
            sort: () => ({ toArray: async () => targets }),
          }),
          updateOne: async () => ({}),
        };
      }

      if (name === "apps") {
        return { updateOne: async () => ({}) };
      }

      return {
        findOne: async () => null,
        insertOne: async () => ({}),
      };
    },
  } as any;
  const provider = {
    platform: "google-play" as const,
    getApp: async (appId: string) => {
      fetched.push(appId);
      if (appId === "first") throw new Error("temporary failure");

      return normalizeApp(
        { title: "Second", updated: 1_700_000_000_000 },
        { appId, fetchedAt: new Date() },
      );
    },
    getReviews: async () => ({ reviews: [] }),
  };
  const previousDelay = process.env.SCRAPE_DELAY_MS;
  process.env.SCRAPE_DELAY_MS = "0";

  try {
    const results = await syncActiveTargets(db, provider);

    assert.deepEqual(fetched, ["first", "second"]);
    assert.equal(results[0]?.success, false);
    assert.equal(results[1]?.success, true);
  } finally {
    if (previousDelay === undefined) delete process.env.SCRAPE_DELAY_MS;
    else process.env.SCRAPE_DELAY_MS = previousDelay;
  }
});

test("disabling a target changes status without deleting it", async () => {
  let update: unknown;
  let deleted = false;
  const db = {
    collection: () => ({
      updateOne: async (...args: unknown[]) => {
        update = args;
        return { matchedCount: 1 };
      },
      deleteOne: async () => {
        deleted = true;
      },
    }),
  } as any;

  assert.equal(
    await setTargetStatus(db, "google-play", "com.example.app", "disabled"),
    true,
  );
  assert.equal(deleted, false);
  const updateDocument = (update as unknown[])[1] as {
    $set: { status: string; updatedAt: unknown };
  };
  assert.equal(updateDocument.$set.status, "disabled");
  assert.ok(updateDocument.$set.updatedAt instanceof Date);
});
