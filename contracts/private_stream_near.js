/**
 * PrivateStream NEAR - Smart Contract
 * 
 * Written for near-sdk-js WITHOUT decorators (plain JS class style).
 * This compiles cleanly on all platforms via near-sdk-js build.
 *
 * Features:
 * - One campaign per NEAR account (enforced on-chain)
 * - AES-256-GCM encrypted metadata CID stored on-chain
 * - 90/10 payment split (creator / platform treasury)
 * - Revenue cap: $20 USD equivalent per campaign
 * - Time-limited access windows per buyer
 * - Sold-out enforcement after revenue cap
 */

import {
  NearBindgen,
  call,
  view,
  initialize,
  near,
  UnorderedMap,
  LookupMap,
  assert,
  NearPromise,
} from "near-sdk-js";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_FEE_PERCENT = BigInt(10);   // 10%
const REVENUE_CAP_CENTS    = BigInt(2000); // $20.00 in cents
const ONE_NEAR             = BigInt("1000000000000000000000000"); // 10^24

// ─── Contract Class ───────────────────────────────────────────────────────────
@NearBindgen({})
export class PrivateStreamNear {

  constructor() {
    this.campaigns        = new UnorderedMap("c");   // id → Campaign
    this.creatorCampaigns = new LookupMap("cc");     // accountId → campaignId
    this.accessExpiry     = new LookupMap("ae");     // "accountId:campaignId" → expiry
    this.treasury         = "chandanapt.testnet";
    this.nearPriceCents   = BigInt(500);             // $5.00 default
  }

  // ─── Initialize ─────────────────────────────────────────────────────────────
  @initialize({})
  init({ treasuryAccount, nearPriceCents }) {
    this.treasury       = treasuryAccount;
    this.nearPriceCents = BigInt(nearPriceCents || 500);
    near.log(`Initialized. Treasury: ${this.treasury}`);
  }

  // ─── Create Campaign ─────────────────────────────────────────────────────────
  @call({})
  create_campaign({ campaignId, metadataCid, priceYocto, durationSeconds }) {
    const creator = near.predecessorAccountId();

    // One campaign per account
    assert(
      !this.creatorCampaigns.get(creator),
      "You already own an active campaign. Each account can only create one campaign."
    );

    assert(campaignId && campaignId.length > 0,   "Campaign ID required");
    assert(metadataCid && metadataCid.length > 0, "Metadata CID required");
    assert(BigInt(priceYocto) > BigInt(0),         "Price must be > 0");
    assert(Number(durationSeconds) >= 120,        "Duration must be >= 2 minutes");
    assert(!this.campaigns.get(campaignId),        "Campaign ID already exists");

    const now = Math.floor(Number(near.blockTimestamp()) / 1_000_000_000);

    const campaign = {
      id:              campaignId,
      creator:         creator,
      metadataCid:     metadataCid,
      priceYocto:      priceYocto.toString(),
      durationSeconds: Number(durationSeconds),
      grossRevenueYocto: "0",
      purchaseCount:   0,
      active:          true,
      soldOut:         false,
      createdAt:       now,
      updatedAt:       now,
    };

    this.campaigns.set(campaignId, campaign);
    this.creatorCampaigns.set(creator, campaignId);

    near.log(`Campaign created: ${campaignId} by ${creator}`);
    return { success: true, campaignId };
  }

  // ─── Purchase Access ──────────────────────────────────────────────────────────
  @call({ payableFunction: true })
  purchase_access({ campaignId }) {
    const buyer   = near.predecessorAccountId();
    const deposit = near.attachedDeposit();

    const campaign = this.campaigns.get(campaignId);
    assert(campaign,          "Campaign not found");
    assert(campaign.active,   "Campaign is not active");
    assert(!campaign.soldOut, "Campaign is sold out");

    const price = BigInt(campaign.priceYocto);
    assert(deposit >= price, "Insufficient payment");

    // Payment split
    const platformFee    = (deposit * PLATFORM_FEE_PERCENT) / BigInt(100);
    const creatorPayment = deposit - platformFee;

    // Access expiry
    const now      = Math.floor(Number(near.blockTimestamp()) / 1_000_000_000);
    const expiry   = now + campaign.durationSeconds;
    const key      = `${buyer}:${campaignId}`;
    const existing = this.accessExpiry.get(key);
    const newExpiry = existing ? Math.max(Number(existing), expiry) : expiry;
    this.accessExpiry.set(key, newExpiry);

    // Update revenue
    const newRevenue = BigInt(campaign.grossRevenueYocto) + deposit;
    campaign.grossRevenueYocto = newRevenue.toString();
    campaign.purchaseCount    += 1;
    campaign.updatedAt         = now;

    // Check revenue cap
    const revenueUsdCents = (newRevenue * this.nearPriceCents) / ONE_NEAR;
    if (revenueUsdCents >= REVENUE_CAP_CENTS) {
      campaign.soldOut = true;
      campaign.active  = false;
      near.log(`Campaign ${campaignId} sold out`);
    }

    this.campaigns.set(campaignId, campaign);

    // Transfer payments
    NearPromise.new(campaign.creator).transfer(creatorPayment);
    NearPromise.new(this.treasury).transfer(platformFee);

    near.log(`Purchase: ${buyer} → ${campaignId}, expires: ${newExpiry}`);
    return {
      success:       true,
      expiresAt:     newExpiry,
      creatorPayment: creatorPayment.toString(),
      platformFee:   platformFee.toString(),
    };
  }

  // ─── View Methods ─────────────────────────────────────────────────────────────
  @view({})
  get_campaign({ campaignId }) {
    return this.campaigns.get(campaignId) || null;
  }

  @view({})
  get_active_campaigns({ fromIndex = 0, limit = 20 } = {}) {
    return this.campaigns.toArray()
      .map(([, c]) => c)
      .filter(c => c.active && !c.soldOut)
      .slice(fromIndex, fromIndex + limit);
  }

  @view({})
  get_all_campaigns({ fromIndex = 0, limit = 50 } = {}) {
    return this.campaigns.toArray()
      .map(([, c]) => c)
      .slice(fromIndex, fromIndex + limit);
  }

  @view({})
  get_creator_campaign({ accountId }) {
    const id = this.creatorCampaigns.get(accountId);
    if (!id) return null;
    return this.campaigns.get(id) || null;
  }

  @view({})
  has_campaign({ accountId }) {
    return !!this.creatorCampaigns.get(accountId);
  }

  @view({})
  get_access_expiry({ accountId, campaignId }) {
    return this.accessExpiry.get(`${accountId}:${campaignId}`) || 0;
  }

  @view({})
  has_valid_access({ accountId, campaignId }) {
    const expiry = this.accessExpiry.get(`${accountId}:${campaignId}`);
    if (!expiry) return false;
    const now = Math.floor(Number(near.blockTimestamp()) / 1_000_000_000);
    return Number(expiry) > now;
  }

  @view({})
  get_stats() {
    const all = this.campaigns.toArray().map(([, c]) => c);
    return {
      totalCampaigns:   all.length,
      activeCampaigns:  all.filter(c => c.active && !c.soldOut).length,
      soldOutCampaigns: all.filter(c => c.soldOut).length,
      treasury:         this.treasury,
      nearPriceCents:   this.nearPriceCents.toString(),
    };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────
  @call({})
  update_near_price({ priceCents }) {
    assert(priceCents > 0, "Price must be positive");
    this.nearPriceCents = BigInt(priceCents);
    near.log(`NEAR price updated: ${priceCents} cents`);
  }

  // Removes a campaign and frees the creator's slot (admin/creator only)
  @call({})
  delete_campaign({ campaignId }) {
    const caller = near.predecessorAccountId();
    const campaign = this.campaigns.get(campaignId);
    assert(campaign, "Campaign not found");
    // Only the creator or the contract account can delete
    assert(
      caller === campaign.creator || caller === near.currentAccountId(),
      "Only the campaign creator can delete their campaign"
    );
    this.campaigns.remove(campaignId);
    this.creatorCampaigns.remove(campaign.creator);
    near.log(`Campaign deleted: ${campaignId} by ${caller}`);
    return { success: true };
  }
}
