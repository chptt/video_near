/**
 * PrivateStream NEAR - Pricing & Revenue Module
 *
 * Handles NEAR/USD conversion, revenue tracking, and payment splitting.
 * Uses CoinGecko API for live prices with fallback to env variable.
 */

import {
  PLATFORM_FEE_PERCENTAGE,
  CREATOR_PERCENTAGE,
  REVENUE_CAP_USD,
  NEAR_USD_FALLBACK,
} from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceData {
  nearUsd: number;
  source: 'live' | 'fallback';
  timestamp: number;
}

export interface PaymentSplit {
  totalNear: string;
  totalUsd: number;
  creatorNear: string;
  creatorUsd: number;
  platformNear: string;
  platformUsd: number;
}

export interface RevenueStatus {
  grossRevenueUsd: number;
  remainingCapUsd: number;
  percentageFilled: number;
  isSoldOut: boolean;
  canAcceptPayment: boolean;
}

// ─── Price Cache ──────────────────────────────────────────────────────────────

let priceCache: PriceData | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches the current NEAR/USD price from CoinGecko.
 * Falls back to NEAR_USD_FALLBACK env variable if API is unavailable.
 */
export async function getNearUsdPrice(): Promise<PriceData> {
  // Return cached price if still fresh
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL_MS) {
    return priceCache;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd',
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) throw new Error('CoinGecko API error');

    const data = await response.json();
    const nearUsd = data?.near?.usd;

    if (!nearUsd || typeof nearUsd !== 'number') {
      throw new Error('Invalid price data');
    }

    priceCache = {
      nearUsd,
      source: 'live',
      timestamp: Date.now(),
    };

    return priceCache;
  } catch (error) {
    console.warn('[Pricing] CoinGecko unavailable, using fallback price:', error);

    const fallback: PriceData = {
      nearUsd: NEAR_USD_FALLBACK,
      source: 'fallback',
      timestamp: Date.now(),
    };

    // Cache fallback for shorter duration (1 minute)
    priceCache = { ...fallback, timestamp: Date.now() - CACHE_TTL_MS + 60000 };

    return fallback;
  }
}

// ─── Conversion Utilities ─────────────────────────────────────────────────────

/**
 * Converts NEAR amount to USD equivalent.
 */
export async function nearToUsd(nearAmount: number): Promise<number> {
  const { nearUsd } = await getNearUsdPrice();
  return nearAmount * nearUsd;
}

/**
 * Converts USD amount to NEAR equivalent.
 */
export async function usdToNear(usdAmount: number): Promise<number> {
  const { nearUsd } = await getNearUsdPrice();
  return usdAmount / nearUsd;
}

/**
 * Converts NEAR amount string to USD (synchronous, uses cached price).
 * Returns 0 if no cached price available.
 */
export function nearToUsdSync(nearAmount: number): number {
  const price = priceCache?.nearUsd || NEAR_USD_FALLBACK;
  return nearAmount * price;
}

// ─── Payment Splitting ────────────────────────────────────────────────────────

/**
 * Calculates the payment split between creator and platform.
 *
 * Example: 5 NEAR at $5/NEAR = $25 total
 * - Creator: 90% = 4.5 NEAR ($22.50)
 * - Platform: 10% = 0.5 NEAR ($2.50)
 *
 * @param nearAmount - Total payment in NEAR (as decimal string)
 * @returns PaymentSplit with exact amounts for both parties
 */
export async function calculatePaymentSplit(nearAmount: string): Promise<PaymentSplit> {
  const { nearUsd } = await getNearUsdPrice();
  const totalNearFloat = parseFloat(nearAmount);
  const totalUsd = totalNearFloat * nearUsd;

  const platformNearFloat = (totalNearFloat * PLATFORM_FEE_PERCENTAGE) / 100;
  const creatorNearFloat = totalNearFloat - platformNearFloat;

  return {
    totalNear: nearAmount,
    totalUsd: Math.round(totalUsd * 100) / 100,
    creatorNear: creatorNearFloat.toFixed(6),
    creatorUsd: Math.round(creatorNearFloat * nearUsd * 100) / 100,
    platformNear: platformNearFloat.toFixed(6),
    platformUsd: Math.round(platformNearFloat * nearUsd * 100) / 100,
  };
}

/**
 * Calculates payment split in yoctoNEAR for smart contract use.
 * Returns exact integer amounts to avoid floating point issues.
 *
 * @param totalYocto - Total payment in yoctoNEAR (as BigInt string)
 * @returns Creator and platform amounts in yoctoNEAR
 */
export function calculateYoctoSplit(totalYocto: string): {
  creatorYocto: string;
  platformYocto: string;
} {
  const total = BigInt(totalYocto);
  const platformYocto = (total * BigInt(PLATFORM_FEE_PERCENTAGE)) / BigInt(100);
  const creatorYocto = total - platformYocto;

  return {
    creatorYocto: creatorYocto.toString(),
    platformYocto: platformYocto.toString(),
  };
}

// ─── Revenue Cap ──────────────────────────────────────────────────────────────

/**
 * Calculates the revenue status for a campaign.
 *
 * @param grossRevenueNear - Total gross revenue collected in NEAR
 * @returns RevenueStatus with cap information
 */
export async function calculateRevenueStatus(
  grossRevenueNear: string
): Promise<RevenueStatus> {
  const { nearUsd } = await getNearUsdPrice();
  const grossRevenueUsd = parseFloat(grossRevenueNear) * nearUsd;
  const remainingCapUsd = Math.max(0, REVENUE_CAP_USD - grossRevenueUsd);
  const percentageFilled = Math.min(100, (grossRevenueUsd / REVENUE_CAP_USD) * 100);
  const isSoldOut = grossRevenueUsd >= REVENUE_CAP_USD;

  return {
    grossRevenueUsd: Math.round(grossRevenueUsd * 100) / 100,
    remainingCapUsd: Math.round(remainingCapUsd * 100) / 100,
    percentageFilled: Math.round(percentageFilled * 10) / 10,
    isSoldOut,
    canAcceptPayment: !isSoldOut,
  };
}

/**
 * Checks if a new payment would exceed the revenue cap.
 *
 * @param currentRevenueNear - Current gross revenue in NEAR
 * @param newPaymentNear - Proposed new payment in NEAR
 * @returns true if the payment would exceed the cap
 */
export async function wouldExceedRevenueCap(
  currentRevenueNear: string,
  newPaymentNear: string
): Promise<boolean> {
  const { nearUsd } = await getNearUsdPrice();
  const currentUsd = parseFloat(currentRevenueNear) * nearUsd;
  const newPaymentUsd = parseFloat(newPaymentNear) * nearUsd;
  return currentUsd + newPaymentUsd > REVENUE_CAP_USD;
}

/**
 * Formats a USD amount for display.
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a NEAR amount for display.
 */
export function formatNearAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0 NEAR';
  return `${num.toFixed(4).replace(/\.?0+$/, '')} NEAR`;
}
