import type { Db } from "mongodb";

import { addMonitoredApp } from "./monitored-apps.js";

const apps = [
  {
    packageName: "com.whatsapp",
    name: "WhatsApp Messenger",
  },
  {
    packageName: "com.spotify.music",
    name: "Spotify: Music and Podcasts",
  },
  {
    packageName: "com.instagram.android",
    name: "Instagram",
  },
  {
    packageName: "com.google.android.youtube",
    name: "YouTube",
  },
  {
    packageName: "com.canva.editor",
    name: "Canva: AI Photo & Video Editor",
  },
];

export async function seedMonitoredApps(db: Db): Promise<void> {
  for (const app of apps) {
    await addMonitoredApp(db, app.packageName, app.name);
  }

  console.log(`✅ Seeded ${apps.length} monitored apps`);
}
