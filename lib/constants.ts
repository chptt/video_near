/**
 * PrivateStream NEAR - Global Constants
 * Central configuration for the entire application.
 */

// ─── NEAR Network ────────────────────────────────────────────────────────────
export const NEAR_NETWORK = process.env.NEXT_PUBLIC_NEAR_NETWORK || 'testnet';
export const NEAR_NODE_URL = process.env.NEXT_PUBLIC_NEAR_NODE_URL || 'https://testnet.rpc.fastnear.com';
export const NEAR_WALLET_URL = process.env.NEXT_PUBLIC_NEAR_WALLET_URL || 'https://wallet.testnet.near.org';
export const NEAR_HELPER_URL = process.env.NEXT_PUBLIC_NEAR_HELPER_URL || 'https://helper.testnet.near.org';
export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'privatestream.testnet';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ─── Platform Economics ───────────────────────────────────────────────────────
/** Maximum gross revenue per campaign in USD before it becomes sold out */
export const REVENUE_CAP_USD = Number(process.env.REVENUE_CAP_USD || 20);

/** Platform commission percentage (10%) */
export const PLATFORM_FEE_PERCENTAGE = Number(process.env.PLATFORM_FEE_PERCENTAGE || 10);

/** Creator revenue percentage (90%) */
export const CREATOR_PERCENTAGE = 100 - PLATFORM_FEE_PERCENTAGE;

/** Fallback NEAR/USD price when oracle is unavailable */
export const NEAR_USD_FALLBACK = Number(process.env.NEAR_USD_FALLBACK || 5);

/** Platform treasury NEAR account */
export const PLATFORM_TREASURY_ACCOUNT = process.env.PLATFORM_TREASURY_ACCOUNT || 'treasury.testnet';

// ─── NEAR Units ───────────────────────────────────────────────────────────────
/** 1 NEAR = 10^24 yoctoNEAR */
export const NEAR_DECIMALS = 24;
export const ONE_NEAR_IN_YOCTO = '1000000000000000000000000';

// ─── Pinata IPFS ──────────────────────────────────────────────────────────────
export const PINATA_GATEWAY_URL = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';
export const PINATA_API_URL = 'https://api.pinata.cloud';

// ─── Campaign Constraints ─────────────────────────────────────────────────────
/** Minimum price in NEAR */
export const MIN_PRICE_NEAR = 0.1;

/** Maximum price in NEAR */
export const MAX_PRICE_NEAR = 100;

/** Minimum access duration in seconds (1 hour) */
export const MIN_DURATION_SECONDS = 3600;

/** Maximum access duration in seconds (30 days) */
export const MAX_DURATION_SECONDS = 30 * 24 * 3600;

/** Default access duration (24 hours) */
export const DEFAULT_DURATION_SECONDS = 86400;

// ─── Access Control ───────────────────────────────────────────────────────────
/** How long a play token is valid (in seconds) */
export const PLAY_TOKEN_TTL_SECONDS = 300; // 5 minutes

// ─── UI ───────────────────────────────────────────────────────────────────────
export const APP_NAME = 'PrivateStream NEAR';
export const APP_TAGLINE = 'Encrypted. Decentralized. Wallet-Gated.';
export const APP_DESCRIPTION =
  'A privacy-preserving video monetization platform built on NEAR Protocol with FHE-inspired encrypted access control.';

// ─── Local Storage Keys ───────────────────────────────────────────────────────
export const LS_WALLET_ACCOUNT = 'ps_near_account';
export const LS_WALLET_KEY = 'ps_near_key';
