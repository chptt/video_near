/**
 * PrivateStream NEAR - Access Control Module
 *
 * Manages buyer access verification, expiry tracking, and play authorization.
 * This is the core of the wallet-gated decryption system.
 *
 * ARCHITECTURE NOTE:
 * Access records are stored on the NEAR smart contract (on-chain).
 * This module provides the server-side verification layer that:
 * 1. Queries the contract for access expiry
 * 2. Verifies wallet ownership via signed messages
 * 3. Issues short-lived play tokens after verification
 * 4. Decrypts video metadata only for authorized users
 */

import { PLAY_TOKEN_TTL_SECONDS } from './constants';
import { generatePlayToken, signPlayToken, verifyPlayToken } from './encryption';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccessRecord {
  accountId: string;
  campaignId: string;
  expiresAt: number; // Unix timestamp in seconds
  purchasedAt: number;
  txHash: string;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  expiresAt?: number;
  remainingSeconds?: number;
  reason?: string;
}

export interface PlayToken {
  token: string;
  signature: string;
  accountId: string;
  campaignId: string;
  expiresAt: number;
}

// ─── In-Memory Play Token Store ───────────────────────────────────────────────
// In production, use Redis or similar. For Vercel serverless, tokens are
// short-lived (5 min) and verified via HMAC signature — no storage needed.

// ─── Access Verification ──────────────────────────────────────────────────────

/**
 * Checks if a buyer has valid access to a campaign.
 * Queries the NEAR smart contract for access expiry.
 *
 * @param accountId - Buyer's NEAR account ID
 * @param campaignId - Campaign ID to check access for
 * @param contractAccessExpiry - Access expiry timestamp from contract (Unix seconds)
 * @returns AccessCheckResult
 */
export function checkAccess(
  accountId: string,
  campaignId: string,
  contractAccessExpiry: number | null
): AccessCheckResult {
  if (!contractAccessExpiry || contractAccessExpiry === 0) {
    return {
      hasAccess: false,
      reason: 'No purchase record found for this wallet',
    };
  }

  const now = Math.floor(Date.now() / 1000);

  if (now > contractAccessExpiry) {
    return {
      hasAccess: false,
      expiresAt: contractAccessExpiry,
      remainingSeconds: 0,
      reason: 'Access has expired',
    };
  }

  const remainingSeconds = contractAccessExpiry - now;

  return {
    hasAccess: true,
    expiresAt: contractAccessExpiry,
    remainingSeconds,
  };
}

/**
 * Checks if access is expired based on a Unix timestamp.
 */
export function isAccessExpired(expiresAt: number): boolean {
  return Math.floor(Date.now() / 1000) > expiresAt;
}

/**
 * Calculates remaining access time in human-readable format.
 */
export function formatRemainingTime(expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiresAt - now;

  if (remaining <= 0) return 'Expired';

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
  return `${seconds}s remaining`;
}

// ─── Play Token Management ────────────────────────────────────────────────────

/**
 * Issues a short-lived play token for an authorized viewer.
 * Tokens are valid for PLAY_TOKEN_TTL_SECONDS (default: 5 minutes).
 * After expiry, the client must request a new token.
 *
 * This simulates the "temporary decryption key" concept from FHE systems:
 * - The token proves the server authorized decryption at a specific time
 * - It cannot be reused after expiry
 * - It is tied to a specific account + campaign pair
 *
 * @param accountId - Verified buyer's NEAR account ID
 * @param campaignId - Campaign ID being accessed
 * @returns PlayToken with HMAC signature
 */
export function issuePlayToken(accountId: string, campaignId: string): PlayToken {
  const token = generatePlayToken();
  const expiresAt = Math.floor(Date.now() / 1000) + PLAY_TOKEN_TTL_SECONDS;
  const signature = signPlayToken(token, accountId, campaignId);

  return {
    token,
    signature,
    accountId,
    campaignId,
    expiresAt,
  };
}

/**
 * Verifies a play token is valid and not expired.
 *
 * @param playToken - The PlayToken to verify
 * @returns true if valid and not expired
 */
export function verifyPlayTokenValidity(playToken: PlayToken): boolean {
  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > playToken.expiresAt) {
    return false;
  }

  // Verify HMAC signature
  return verifyPlayToken(
    playToken.token,
    playToken.signature,
    playToken.accountId,
    playToken.campaignId
  );
}

// ─── Access Duration Formatting ───────────────────────────────────────────────

/**
 * Converts duration in seconds to human-readable format.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  const days = Math.floor(seconds / 86400);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Calculates the access expiry timestamp from purchase time + duration.
 */
export function calculateExpiryTimestamp(
  purchaseTimestamp: number,
  durationSeconds: number
): number {
  return purchaseTimestamp + durationSeconds;
}
