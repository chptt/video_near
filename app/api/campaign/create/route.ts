/**
 * POST /api/campaign/create
 *
 * Creates a new campaign:
 * 1. Validates input
 * 2. Enforces one-campaign-per-account rule
 * 3. Encrypts the YouTube URL (AES-256-GCM)
 * 4. Uploads encrypted metadata to Pinata IPFS
 * 5. Returns the IPFS CID for on-chain storage
 *
 * The frontend then calls the NEAR smart contract with the CID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { encryptVideoUrl } from '@/lib/encryption';
import { uploadMetadataToIPFS, CampaignMetadata } from '@/lib/ipfs';
import {
  validateCampaignInput,
  sanitizeCampaignInput,
  isValidNearAccountId,
} from '@/lib/validation';
import { normalizeYouTubeUrl } from '@/lib/youtube';
import {
  registerCampaign,
  creatorHasCampaign,
  Campaign,
} from '@/lib/campaignRegistry';
import {
  REVENUE_CAP_USD,
  PLATFORM_FEE_PERCENTAGE,
} from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      creatorAccount,
      title,
      description,
      videoUrl,
      priceNear,
      durationSeconds,
    } = body;

    // ── Validate creator account ──────────────────────────────────────────────
    if (!creatorAccount || !isValidNearAccountId(creatorAccount)) {
      return NextResponse.json(
        { error: 'Invalid NEAR account ID' },
        { status: 400 }
      );
    }

    // ── Enforce one campaign per account ──────────────────────────────────────
    if (creatorHasCampaign(creatorAccount)) {
      return NextResponse.json(
        {
          error: 'You already own an active campaign. Each NEAR account can only create one campaign.',
          code: 'DUPLICATE_CAMPAIGN',
        },
        { status: 409 }
      );
    }

    // ── Validate and sanitize input ───────────────────────────────────────────
    const rawInput = { title, description, videoUrl, priceNear, durationSeconds };
    const validation = validateCampaignInput(rawInput);

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const sanitized = sanitizeCampaignInput(rawInput);

    // ── Normalize YouTube URL ─────────────────────────────────────────────────
    const normalizedUrl = normalizeYouTubeUrl(sanitized.videoUrl);
    if (!normalizedUrl) {
      return NextResponse.json(
        { error: 'Could not parse YouTube URL' },
        { status: 400 }
      );
    }

    // ── Encrypt the YouTube URL ───────────────────────────────────────────────
    // This is the core privacy step: the raw URL never leaves the server unencrypted
    const encrypted = encryptVideoUrl(normalizedUrl);

    // ── Generate campaign ID ──────────────────────────────────────────────────
    const campaignId = uuidv4();

    // ── Build metadata for IPFS ───────────────────────────────────────────────
    const metadata: CampaignMetadata = {
      campaignId,
      title: sanitized.title,
      description: sanitized.description,
      encryptedVideoUrl: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      creatorAccount,
      priceNear: sanitized.priceNear,
      durationSeconds: sanitized.durationSeconds,
      revenueCapUsd: REVENUE_CAP_USD,
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    // ── Upload to Pinata IPFS ─────────────────────────────────────────────────
    const { cid, url: ipfsUrl } = await uploadMetadataToIPFS(metadata);

    // ── Register in local registry ────────────────────────────────────────────
    const campaign: Campaign = {
      id: campaignId,
      creatorAccount,
      metadataCid: cid,
      title: sanitized.title,
      description: sanitized.description,
      priceNear: sanitized.priceNear,
      durationSeconds: sanitized.durationSeconds,
      grossRevenueNear: '0',
      grossRevenueUsd: 0,
      purchaseCount: 0,
      active: true,
      soldOut: false,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };

    registerCampaign(campaign);

    // ── Return CID for on-chain storage ───────────────────────────────────────
    return NextResponse.json({
      success: true,
      campaignId,
      metadataCid: cid,
      ipfsUrl,
      message: 'Campaign metadata encrypted and uploaded to IPFS. Now call the smart contract with the CID.',
    });
  } catch (error) {
    console.error('[API] Campaign create error:', error);

    if (error instanceof Error && error.message.includes('PINATA_JWT')) {
      return NextResponse.json(
        { error: 'IPFS storage not configured. Please set PINATA_JWT.' },
        { status: 503 }
      );
    }

    if (error instanceof Error && error.message.includes('ENCRYPTION_MASTER_KEY')) {
      return NextResponse.json(
        { error: 'Encryption not configured. Please set ENCRYPTION_MASTER_KEY.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create campaign. Please try again.' },
      { status: 500 }
    );
  }
}
