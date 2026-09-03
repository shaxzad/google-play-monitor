import type { AppPlatform } from "./platform.js";

/**
 * Normalized review as produced by a provider.
 *
 * Identity is (platform, appId, reviewId). The raw store payload is never
 * carried here or stored.
 */
export interface NormalizedReview {
  platform: AppPlatform;
  appId: string;

  reviewId?: string;
  userName?: string;
  userImage?: string;
  rating?: number;
  text?: string;
  version?: string;
  thumbsUp?: number;
  publishedAt?: Date;
}
