import { app } from "@mradex77/google-play-scraper";

export interface ScrapedApp {
  packageName: string;

  title?: string;
  summary?: string;
  description?: string;

  developer?: string;
  developerId?: string;
  developerEmail?: string;
  developerWebsite?: string;

  genre?: string;

  score?: number;
  ratings?: number;
  reviews?: number;

  installs?: string;

  price?: number;
  free?: boolean;
  currency?: string;

  version?: string;
  updated?: string;

  icon?: string;
  screenshots?: string[];

  url?: string;

  contentRating?: string;

  raw?: unknown;

  scrapedAt: Date;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function scrapeApp(packageName: string): Promise<ScrapedApp> {
  const normalizedPackageName = packageName.trim();

  if (!normalizedPackageName) {
    throw new Error("Package name cannot be empty");
  }

  const result = await app({
    appId: normalizedPackageName,
    lang: process.env.GOOGLE_PLAY_LANGUAGE || "en",
    country: process.env.GOOGLE_PLAY_COUNTRY || "us",
  });

  const data = result as Record<string, unknown>;

  return {
    packageName: normalizedPackageName,

    title: normalizeString(data.title),

    summary: normalizeString(data.summary),

    description: normalizeString(data.description),

    developer: normalizeString(data.developer),

    developerId: normalizeString(data.developerId),

    developerEmail: normalizeString(data.developerEmail),

    developerWebsite: normalizeString(data.developerWebsite),

    genre: normalizeString(data.genre),

    score: normalizeNumber(data.score),

    ratings: normalizeNumber(data.ratings),

    reviews: normalizeNumber(data.reviews),

    installs: normalizeString(data.installs),

    price: normalizeNumber(data.price),

    free: typeof data.free === "boolean" ? data.free : undefined,

    currency: normalizeString(data.currency),

    version: normalizeString(data.version),

    updated: normalizeString(data.updated),

    icon: normalizeString(data.icon),

    screenshots: normalizeStringArray(data.screenshots),

    url: normalizeString(data.url),

    contentRating: normalizeString(data.contentRating),

    raw: result,

    scrapedAt: new Date(),
  };
}
