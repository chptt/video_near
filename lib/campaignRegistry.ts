/**
 * PrivateStream NEAR - Campaign Registry
 *
 * Server-side in-memory campaign registry for the MVP.
 * In production, this would be replaced by direct smart contract queries.
 *
 * ARCHITECTURE NOTE:
 * This registry acts as a caching layer between the NEAR contract and the API.
 * All authoritative data lives on-chain; this is a read-through cache.
 *
 * For Vercel serverless: Each function invocation may have a fresh memory state.
 * The registry re-hydrates from the smart contract on each cold start.
 * For persistence across invocations, use Vercel KV or similar edge storage.
 */

import { CampaignMetadata } from './ipfs';
import { REVENUE_CAP_USD } from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Campaign {
  /** Unique campaign ID (UUID v4) */
  id: string;
  /** NEAR account ID of the creator */
  creatorAccount: string;
  /** IPFS CID of the encrypted metadata */
  metadataCid: string;
  /** Campaign title (public) */
  title: string;
  /** Campaign description (public) */
  description: string;
  /** Price in NEAR (as decimal string) */
  priceNear: string;
  /** Access duration in seconds */
  durationSeconds: number;
  /** Total gross revenue collected in NEAR */
  grossRevenueNear: string;
  /** Total gross revenue in USD (cached) */
  grossRevenueUsd: number;
  /** Number of purchases */
  purchaseCount: number;
  /** Whether the campaign is active */
  active: boolean;
  /** Whether the revenue cap has been reached */
  soldOut: boolean;
  /** Unix timestamp of campaign creation */
  createdAt: number;
  /** Unix timestamp of last update */
  updatedAt: number;
  /** NEAR smart contract app ID (if deployed) */
  contractCampaignId?: string;
}

export interface PurchaseRecord {
  campaignId: string;
  buyerAccount: string;
  txHash: string;
  amountNear: string;
  purchasedAt: number;
  expiresAt: number;
}

// ─── In-Memory Store ──────────────────────────────────────────────────────────
// NOTE: This is reset on each Vercel cold start.
// For production, replace with Vercel KV, PlanetScale, or similar.

const campaigns = new Map<string, Campaign>();
const purchasesByAccount = new Map<string, PurchaseRecord[]>();
const campaignsByCreator = new Map<string, string>(); // accountId -> campaignId

// ─── Campaign CRUD ────────────────────────────────────────────────────────────

/**
 * Registers a new campaign in the registry.
 * Called after successful IPFS upload and contract interaction.
 */
export function registerCampaign(campaign: Campaign): void {
  campaigns.set(campaign.id, campaign);
  campaignsByCreator.set(campaign.creatorAccount, campaign.id);
}

/**
 * Retrieves a campaign by ID.
 */
export function getCampaign(campaignId: string): Campaign | null {
  return campaigns.get(campaignId) || null;
}

/**
 * Retrieves all active (non-sold-out) campaigns for the marketplace.
 */
export function getActiveCampaigns(): Campaign[] {
  return Array.from(campaigns.values())
    .filter((c) => c.active && !c.soldOut)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Retrieves all campaigns (including sold out) for admin/creator views.
 */
export function getAllCampaigns(): Campaign[] {
  return Array.from(campaigns.values()).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Gets the campaign created by a specific NEAR account.
 * Returns null if the account has no campaign (enforces one-per-account rule).
 */
export function getCampaignByCreator(accountId: string): Campaign | null {
  const campaignId = campaignsByCreator.get(accountId);
  if (!campaignId) return null;
  return campaigns.get(campaignId) || null;
}

/**
 * Checks if a NEAR account already has a campaign.
 * Used to enforce the one-campaign-per-account rule.
 */
export function creatorHasCampaign(accountId: string): boolean {
  return campaignsByCreator.has(accountId);
}

/**
 * Updates campaign revenue after a purchase.
 * Checks if the revenue cap has been reached.
 */
export function recordPurchaseRevenue(
  campaignId: string,
  amountNear: string,
  amountUsd: number
): Campaign | null {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return null;

  const newRevenueNear =
    parseFloat(campaign.grossRevenueNear) + parseFloat(amountNear);
  const newRevenueUsd = campaign.grossRevenueUsd + amountUsd;
  const soldOut = newRevenueUsd >= REVENUE_CAP_USD;

  const updated: Campaign = {
    ...campaign,
    grossRevenueNear: newRevenueNear.toFixed(6),
    grossRevenueUsd: Math.round(newRevenueUsd * 100) / 100,
    purchaseCount: campaign.purchaseCount + 1,
    soldOut,
    active: !soldOut,
    updatedAt: Math.floor(Date.now() / 1000),
  };

  campaigns.set(campaignId, updated);
  return updated;
}

/**
 * Marks a campaign as sold out.
 */
export function markCampaignSoldOut(campaignId: string): void {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return;

  campaigns.set(campaignId, {
    ...campaign,
    soldOut: true,
    active: false,
    updatedAt: Math.floor(Date.now() / 1000),
  });
}

// ─── Purchase Records ─────────────────────────────────────────────────────────

/**
 * Records a purchase for access tracking.
 */
export function recordPurchase(purchase: PurchaseRecord): void {
  const existing = purchasesByAccount.get(purchase.buyerAccount) || [];

  // Prevent duplicate transaction processing
  const isDuplicate = existing.some((p) => p.txHash === purchase.txHash);
  if (isDuplicate) {
    console.warn(`[Registry] Duplicate transaction detected: ${purchase.txHash}`);
    return;
  }

  purchasesByAccount.set(purchase.buyerAccount, [...existing, purchase]);
}

/**
 * Gets the access record for a buyer on a specific campaign.
 * Returns the most recent (latest expiry) purchase.
 */
export function getAccessRecord(
  accountId: string,
  campaignId: string
): PurchaseRecord | null {
  const purchases = purchasesByAccount.get(accountId) || [];
  const campaignPurchases = purchases
    .filter((p) => p.campaignId === campaignId)
    .sort((a, b) => b.expiresAt - a.expiresAt);

  return campaignPurchases[0] || null;
}

/**
 * Gets all purchases for a buyer.
 */
export function getBuyerPurchases(accountId: string): PurchaseRecord[] {
  return purchasesByAccount.get(accountId) || [];
}

/**
 * Checks if a transaction hash has already been processed.
 * Prevents replay attacks.
 */
export function isTransactionProcessed(txHash: string): boolean {
  for (const purchases of purchasesByAccount.values()) {
    if (purchases.some((p) => p.txHash === txHash)) {
      return true;
    }
  }
  return false;
}

// ─── Registry Stats ───────────────────────────────────────────────────────────

/**
 * Removes a campaign from the registry (admin use).
 */
export function clearCampaign(campaignId: string, creatorAccount: string): void {
  campaigns.delete(campaignId);
  campaignsByCreator.delete(creatorAccount);
}

export function getRegistryStats() {
  return {
    totalCampaigns: campaigns.size,
    activeCampaigns: getActiveCampaigns().length,
    soldOutCampaigns: Array.from(campaigns.values()).filter((c) => c.soldOut).length,
    totalPurchases: Array.from(purchasesByAccount.values()).reduce(
      (sum, purchases) => sum + purchases.length,
      0
    ),
  };
}
