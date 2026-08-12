import type { Db } from "mongodb";

export interface MonitoredApp {
  packageName: string;
  name?: string;
  active: boolean;

  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

export async function addMonitoredApp(
  db: Db,
  packageName: string,
  name?: string,
): Promise<MonitoredApp> {
  const now = new Date();

  const result = await db
    .collection<MonitoredApp>("monitored_apps")
    .findOneAndUpdate(
      {
        packageName,
      },
      {
        $set: {
          packageName,
          ...(name !== undefined ? { name } : {}),
          active: true,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

  if (!result) {
    throw new Error(`Failed to add monitored app: ${packageName}`);
  }

  return result;
}

export async function removeMonitoredApp(
  db: Db,
  packageName: string,
): Promise<boolean> {
  const result = await db.collection<MonitoredApp>("monitored_apps").deleteOne({
    packageName,
  });

  return result.deletedCount > 0;
}

export async function setMonitoredAppStatus(
  db: Db,
  packageName: string,
  active: boolean,
): Promise<boolean> {
  const result = await db.collection<MonitoredApp>("monitored_apps").updateOne(
    {
      packageName,
    },
    {
      $set: {
        active,
        updatedAt: new Date(),
      },
    },
  );

  return result.matchedCount > 0;
}

export async function getMonitoredApps(
  db: Db,
  activeOnly = false,
): Promise<MonitoredApp[]> {
  const filter = activeOnly ? { active: true } : {};

  return db
    .collection<MonitoredApp>("monitored_apps")
    .find(filter)
    .sort({
      name: 1,
    })
    .toArray();
}

export async function getMonitoredApp(
  db: Db,
  packageName: string,
): Promise<MonitoredApp | null> {
  return db.collection<MonitoredApp>("monitored_apps").findOne({
    packageName,
  });
}
