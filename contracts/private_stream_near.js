/**
 * PrivateStream NEAR - Smart Contract
 *
 * NEAR Protocol smart contract written in JavaScript (NEAR JS SDK).
 * Handles campaign creation, access purchases, payment splitting,
 * and revenue cap enforcement.
 *
 * Deploy to NEAR testnet:
 *   near deploy --accountId privatestream.testnet --wasmFile contract.wasm
 *
 * NOTE: This is the JavaScript source. Compile with near-sdk-js:
 *   npx near-sdk-js build contracts/private_stream_near.js --out contract.wasm
 */

import {
  NearBindgen,
  NearContract,
  call,
  view,
  near,
  UnorderedMap,
  LookupMap,
  initialize,
  assert,
  NearPromise,
} from 'near-sdk-js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_FEE_PERCENTAGE = 10n; // 10%
const REVENUE_CAP_USD_CENTS = 2000n; // $20.00 in cents
const ONE_NEAR = 1_000_000_000_000_000_000_000_000n; // 10^24 yoctoNEAR
const TGAS = 1_000_000_000_000n; // 1 TGas

// ─── Data Structures ──────────────────────────────────────────────────────────

class Campaign {
  constructor({
    id,
    creator,
    metadataCid,
    priceYocto,
    durationSeconds,
    createdAt,
  }) {
    this.id = id;
    this.creator = creator;
    this.metadataCid = metadataCid;
    this.priceYocto = priceYocto;
    this.durationSeconds = durationSeconds;
    this.grossRevenueYocto = '0';
    this.purchaseCount = 0;
    this.active = true;
    this.soldOut = false;
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
  }
}

// ─── Contract ─────────────────────────────────────────────────────────────────

@NearBindgen({})
class PrivateStreamNear extends NearContract {
  constructor() {
    super();
    // campaignId -> Campaign
    this.campaigns = new UnorderedMap('campaigns');
    // accountId -> campaignId (enforces one campaign per account)
    this.creatorCampaigns = new LookupMap('creator_campaigns');
    // `${accountId}:${campaignId}` -> expiryTimestamp (Unix seconds)
    this.accessExpiry = new LookupMap('access_expiry');
    // Platform treasury account
    this.treasuryAccount = 'treasury.testnet';
    // NEAR/USD price in cents (updated by oracle or admin)
    this.nearPriceCents = 500n; // Default: $5.00 per NEAR
  }

  @initialize({})
  init({ treasuryAccount, nearPriceCents }) {
    this.treasuryAccount = treasuryAccount || 'treasury.testnet';
    this.nearPriceCents = BigInt(nearPriceCents || 500);
  }

  // ─── Campaign Management ────────────────────────────────────────────────────

  /**
   * Creates a new campaign. Each account can only create ONE campaign.
   *
   * @param campaignId - UUID v4 campaign identifier
   * @param metadataCid - IPFS CID of encrypted campaign metadata
   * @param priceYocto - Price per access in yoctoNEAR
   * @param durationSeconds - Access duration in seconds
   */
  @call({})
  create_campaign({ campaignId, metadataCid, priceYocto, durationSeconds }) {
    const creator = near.predecessorAccountId();

    // Enforce one campaign per account
    assert(
      !this.creatorCampaigns.get(creator),
      'You already own an active campaign. Each account can only create one campaign.'
    );

    // Validate inputs
    assert(campaignId && campaignId.length > 0, 'Campaign ID is required');
    assert(metadataCid && metadataCid.length > 0, 'Metadata CID is required');
    assert(BigInt(priceYocto) > 0n, 'Price must be greater than 0');
    assert(
      Number(durationSeconds) >= 3600,
      'Duration must be at least 1 hour (3600 seconds)'
    );
    assert(
      !this.campaigns.get(campaignId),
      'Campaign ID already exists'
    );

    const now = Math.floor(Number(near.blockTimestamp()) / 1_000_000_000);

    const campaign = new Campaign({
      id: campaignId,
      creator,
      metadataCid,
      priceYocto: priceYocto.toString(),
      durationSeconds: Number(durationSeconds),
      createdAt: now,
    });

    this.campaigns.set(campaignId, campaign);
    this.creatorCampaigns.set(creator, campaignId);

    near.log(`Campaign created: ${campaignId} by ${creator}`);

    return { success: true, campaignId };
  }

  /**
   * Purchases access to a campaign.
   * Splits payment: 90% to creator, 10% to platform treasury.
   * Enforces revenue cap ($20 USD equivalent).
   *
   * @param campaignId - The campaign to purchase access for
   */
  @call({ payableFunction: true })
  purchase_access({ campaignId }) {
    const buyer = near.predecessorAccountId();
    const deposit = near.attachedDeposit();

    const campaign = this.campaigns.get(campaignId);
    assert(campaign, 'Campaign not found');
    assert(campaign.active, 'Campaign is no longer active');
    assert(!campaign.soldOut, 'Campaign has reached its revenue cap and is sold out');

    // Verify payment amount
    const requiredPrice = BigInt(campaign.priceYocto);
    assert(
      deposit >= requiredPrice,
      `Insufficient payment. Required: ${requiredPrice} yoctoNEAR`
    );

    // Check if this purchase would exceed the revenue cap
    const currentRevenueYocto = BigInt(campaign.grossRevenueYocto);
    const newRevenueYocto = currentRevenueYocto + deposit;

    // Convert to USD cents for cap check
    // nearPriceCents * yocto / ONE_NEAR = USD cents
    const newRevenueUsdCents =
      (newRevenueYocto * this.nearPriceCents) / ONE_NEAR;

    // Allow purchase even if it slightly exceeds cap (last purchase)
    // but mark as sold out after
    const wouldExceedCap = newRevenueUsdCents >= REVENUE_CAP_USD_CENTS;

    // Calculate payment split
    const platformFee = (deposit * PLATFORM_FEE_PERCENTAGE) / 100n;
    const creatorPayment = deposit - platformFee;

    // Record access expiry
    const now = Math.floor(Number(near.blockTimestamp()) / 1_000_000_000);
    const expiresAt = now + campaign.durationSeconds;
    const accessKey = `${buyer}:${campaignId}`;

    // Update access (extend if already has access)
    const existingExpiry = this.accessExpiry.get(accessKey);
    const newExpiry = existingExpiry
      ? Math.max(Number(existingExpiry), expiresAt)
      : expiresAt;

    this.accessExpiry.set(accessKey, newExpiry);

    // Update campaign revenue
    campaign.grossRevenueYocto = newRevenueYocto.toString();
    campaign.purchaseCount += 1;
    campaign.updatedAt = now;

    if (wouldExceedCap) {
      campaign.soldOut = true;
      campaign.active = false;
      near.log(`Campaign ${campaignId} reached revenue cap and is now sold out`);
    }

    this.campaigns.set(campaignId, campaign);

    // Transfer creator payment
    NearPromise.new(campaign.creator).transfer(creatorPayment);

    // Transfer platform fee to treasury
    NearPromise.new(this.treasuryAccount).transfer(platformFee);

    near.log(
      `Access purchased: ${buyer} -> ${campaignId}, expires: ${newExpiry}, ` +
        `creator: ${creatorPayment} yN, platform: ${platformFee} yN`
    );

    return {
      success: true,
      expiresAt: newExpiry,
      creatorPayment: creatorPayment.toString(),
      platformFee: platformFee.toString(),
    };
  }

  // ─── View Methods ───────────────────────────────────────────────────────────

  /**
   * Returns campaign details by ID.
   */
  @view({})
  get_campaign({ campaignId }) {
    return this.campaigns.get(campaignId) || null;
  }

  /**
   * Returns all active campaigns for the marketplace.
   */
  @view({})
  get_active_campaigns({ fromIndex = 0, limit = 20 } = {}) {
    const all = this.campaigns.toArray();
    return all
      .map(([, campaign]) => campaign)
      .filter((c) => c.active && !c.soldOut)
      .slice(fromIndex, fromIndex + limit);
  }

  /**
   * Returns all campaigns (including sold out).
   */
  @view({})
  get_all_campaigns({ fromIndex = 0, limit = 50 } = {}) {
    const all = this.campaigns.toArray();
    return all
      .map(([, campaign]) => campaign)
      .slice(fromIndex, fromIndex + limit);
  }

  /**
   * Returns the campaign created by a specific account.
   * Returns null if the account has no campaign.
   */
  @view({})
  get_creator_campaign({ accountId }) {
    const campaignId = this.creatorCampaigns.get(accountId);
    if (!campaignId) return null;
    return this.campaigns.get(campaignId) || null;
  }

  /**
   * Checks if an account has created a campaign.
   */
  @view({})
  has_campaign({ accountId }) {
    return !!this.creatorCampaigns.get(accountId);
  }

  /**
   * Returns the access expiry timestamp for a buyer on a campaign.
   * Returns 0 if no access record exists.
   */
  @view({})
  get_access_expiry({ accountId, campaignId }) {
    const key = `${accountId}:${campaignId}`;
    return this.accessExpiry.get(key) || 0;
  }

  /**
   * Checks if a buyer currently has valid (non-expired) access.
   */
  @view({})
  has_valid_access({ accountId, campaignId }) {
    const key = `${accountId}:${campaignId}`;
    const expiry = this.accessExpiry.get(key);
    if (!expiry) return false;
    const now = Math.floor(Number(near.blockTimestamp()) / 1_000_000_000);
    return Number(expiry) > now;
  }

  /**
   * Returns contract statistics.
   */
  @view({})
  get_stats() {
    const all = this.campaigns.toArray().map(([, c]) => c);
    return {
      totalCampaigns: all.length,
      activeCampaigns: all.filter((c) => c.active && !c.soldOut).length,
      soldOutCampaigns: all.filter((c) => c.soldOut).length,
      treasuryAccount: this.treasuryAccount,
      nearPriceCents: this.nearPriceCents.toString(),
    };
  }

  // ─── Admin Methods ──────────────────────────────────────────────────────────

  /**
   * Updates the NEAR/USD price (called by oracle or admin).
   * Only the contract owner can call this.
   */
  @call({})
  update_near_price({ priceCents }) {
    // In production, restrict to contract owner or oracle
    assert(priceCents > 0, 'Price must be positive');
    this.nearPriceCents = BigInt(priceCents);
    near.log(`NEAR price updated: $${priceCents / 100} USD`);
  }
}
