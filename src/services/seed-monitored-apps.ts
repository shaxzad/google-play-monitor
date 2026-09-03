import type { Db } from "mongodb";

import { addTarget } from "./targets.js";

/**
 * Safe example seed.
 *
 * Creates a small set of ACTIVE affiliate targets so the pipeline can be run
 * end-to-end locally. These are well-known, public apps used purely as
 * examples of the target mechanism.
 *
 * IMPORTANT: This seed intentionally does NOT create operators, affiliate
 * programs, campaigns, or any commission information. Those describe real
 * commercial relationships and must never be fabricated. Targets are created
 * with no affiliate links attached; every target is annotated as an example.
 */

const EXAMPLE_TARGETS: { appId: string; note: string }[] = [
  { appId: "com.whatsapp", note: "WhatsApp Messenger" },
  { appId: "com.spotify.music", note: "Spotify: Music and Podcasts" },
  { appId: "com.instagram.android", note: "Instagram" },
  { appId: "com.google.android.youtube", note: "YouTube" },
  { appId: "com.canva.editor", note: "Canva: AI Photo & Video Editor" },
];

export async function seedMonitoredApps(db: Db): Promise<void> {
  for (const target of EXAMPLE_TARGETS) {
    await addTarget(db, {
      appId: target.appId,
      platform: "google-play",
      status: "active",
      notes: `example seed — ${target.note}`,
    });
  }

  console.log(
    `✅ Seeded ${EXAMPLE_TARGETS.length.toString()} example targets (no affiliate data)`,
  );
}
