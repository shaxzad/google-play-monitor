import { reviews as fetchReviews } from "@mradex77/google-play-scraper";

export type ReviewSort = 1 | 2 | 3;

export interface ScrapedReview {
  packageName: string;

  reviewId?: string;

  userName?: string;

  userImage?: string;

  rating?: number;

  text?: string;

  version?: string;

  thumbsUp?: number;

  publishedAt?: Date;

  raw?: unknown;
}

export interface ReviewScrapeOptions {
  packageName: string;

  num?: number;

  sort?: ReviewSort;

  lang?: string;

  country?: string;

  nextPaginationToken?: string;
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

function normalizeDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
}

export async function scrapeReviews(options: ReviewScrapeOptions): Promise<{
  reviews: ScrapedReview[];
  nextPaginationToken?: string;
}> {
  const {
    packageName,

    num = 100,

    sort = 2,

    lang = process.env.GOOGLE_PLAY_LANGUAGE || "en",

    country = process.env.GOOGLE_PLAY_COUNTRY || "us",

    nextPaginationToken,
  } = options;

  const result = await fetchReviews({
    appId: packageName,

    num,

    sort,

    lang,

    country,

    nextPaginationToken,
  });

  const resultData = result as Record<string, unknown>;

  const rawReviews = Array.isArray(resultData.data) ? resultData.data : [];

  const normalizedReviews: ScrapedReview[] = rawReviews.map((item: unknown) => {
    const review = item as Record<string, unknown>;

    return {
      packageName,

      reviewId: normalizeString(review.id),

      userName: normalizeString(review.userName),

      userImage: normalizeString(review.userImage),

      rating: normalizeNumber(review.score),

      text: normalizeString(review.text),

      version: normalizeString(review.version),

      thumbsUp: normalizeNumber(review.thumbsUp),

      publishedAt: normalizeDate(review.date),

      raw: item,
    };
  });

  return {
    reviews: normalizedReviews,

    nextPaginationToken:
      typeof resultData.nextPaginationToken === "string"
        ? resultData.nextPaginationToken
        : undefined,
  };
}
