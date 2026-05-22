/**
 * PrivateStream NEAR - Validation Module
 *
 * Input validation for campaigns, payments, and user data.
 * Used by both frontend forms and backend API routes.
 */

import {
  MIN_PRICE_NEAR,
  MAX_PRICE_NEAR,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
} from './constants';
import { isValidYouTubeUrl } from './youtube';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface CampaignCreateInput {
  title: string;
  description: string;
  videoUrl: string;
  priceNear: string;
  durationSeconds: number;
}

// ─── Campaign Validation ──────────────────────────────────────────────────────

/**
 * Validates campaign creation input.
 * Used on both frontend and backend for consistent validation.
 */
export function validateCampaignInput(input: CampaignCreateInput): ValidationResult {
  const errors: Record<string, string> = {};

  // Title validation
  if (!input.title || input.title.trim().length === 0) {
    errors.title = 'Campaign title is required';
  } else if (input.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters';
  } else if (input.title.trim().length > 100) {
    errors.title = 'Title must be 100 characters or less';
  }

  // Description validation
  if (!input.description || input.description.trim().length === 0) {
    errors.description = 'Campaign description is required';
  } else if (input.description.trim().length < 10) {
    errors.description = 'Description must be at least 10 characters';
  } else if (input.description.trim().length > 1000) {
    errors.description = 'Description must be 1000 characters or less';
  }

  // YouTube URL validation
  if (!input.videoUrl || input.videoUrl.trim().length === 0) {
    errors.videoUrl = 'YouTube video URL is required';
  } else if (!isValidYouTubeUrl(input.videoUrl.trim())) {
    errors.videoUrl =
      'Invalid YouTube URL. Supported: youtube.com/watch?v=..., youtu.be/...';
  }

  // Price validation
  const price = parseFloat(input.priceNear);
  if (!input.priceNear || isNaN(price)) {
    errors.priceNear = 'Price is required';
  } else if (price < MIN_PRICE_NEAR) {
    errors.priceNear = `Minimum price is ${MIN_PRICE_NEAR} NEAR`;
  } else if (price > MAX_PRICE_NEAR) {
    errors.priceNear = `Maximum price is ${MAX_PRICE_NEAR} NEAR`;
  }

  // Duration validation
  if (!input.durationSeconds || isNaN(input.durationSeconds)) {
    errors.durationSeconds = 'Access duration is required';
  } else if (input.durationSeconds < MIN_DURATION_SECONDS) {
    errors.durationSeconds = `Minimum duration is 2 minutes`;
  } else if (input.durationSeconds > MAX_DURATION_SECONDS) {
    errors.durationSeconds = `Maximum duration is ${MAX_DURATION_SECONDS / 86400} days`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── NEAR Account Validation ──────────────────────────────────────────────────

/**
 * Validates a NEAR account ID format.
 * NEAR account IDs: 2-64 chars, lowercase alphanumeric + hyphens + dots
 */
export function isValidNearAccountId(accountId: string): boolean {
  if (!accountId || typeof accountId !== 'string') return false;
  const trimmed = accountId.trim().toLowerCase();
  if (trimmed.length < 2 || trimmed.length > 64) return false;
  // Must match NEAR account ID format
  return /^[a-z0-9]([a-z0-9\-_\.]*[a-z0-9])?$/.test(trimmed);
}

// ─── Transaction Hash Validation ──────────────────────────────────────────────

/**
 * Validates a NEAR transaction hash format.
 * NEAR tx hashes are base58-encoded 32-byte hashes.
 */
export function isValidTransactionHash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  // Base58 characters, typically 43-44 chars for NEAR tx hashes
  return /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(hash.trim());
}

// ─── Campaign ID Validation ───────────────────────────────────────────────────

/**
 * Validates a campaign ID (UUID v4 format).
 */
export function isValidCampaignId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id.trim()
  );
}

// ─── Sanitization ─────────────────────────────────────────────────────────────

/**
 * Sanitizes a string for safe storage (removes HTML, trims whitespace).
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .replace(/javascript:/gi, '') // Remove JS protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Sanitizes campaign input for storage.
 */
export function sanitizeCampaignInput(input: CampaignCreateInput): CampaignCreateInput {
  return {
    title: sanitizeString(input.title),
    description: sanitizeString(input.description),
    videoUrl: input.videoUrl.trim(),
    priceNear: input.priceNear.trim(),
    durationSeconds: Math.floor(input.durationSeconds),
  };
}
