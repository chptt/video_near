/**
 * POST /api/campaign/[campaignId]/play
 *
 * The most security-critical endpoint.
 * Verifies wallet access and returns a decrypted embed URL ONLY for authorized viewers.
 *
 * SECURITY MODEL (FHE-Inspired):
 * 1. Buyer provides their NEAR account ID
 * 2. Server verifies access record on-chain (or in registry)
 * 3. Server verifies access has not expired
 * 4. Server fetches encrypted metadata from IPFS
 * 5. Server decrypts the YouTube URL using ENCRYPTION_MASTER_KEY
 * 6. Server converts to embed URL (never returns raw watch URL)
 * 7. Server issues a short-lived play token (5 min TTL)
 * 8. Client uses embed URL in iframe — raw URL never exposed
 *
 * The ENCRYPTION_MASTER_KEY never leaves the server.
 * The raw YouTube URL never reaches the client.
 * Only the embed URL (which cannot be used to download) is returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign, getAccessRecord } from '@/lib/campaignRegistry';
import { fetchMetadataFromIPFS } from '@/lib/ipfs';
import { decryptVideoUrl } from '@/lib/encryption';
import { checkAccess, issuePlayToken, formatRemainingTime } from '@/lib/access';
import { toEmbedUrl } from '@/lib/youtube';
import { isValidCampaignId, isValidNearAccountId } from '@/lib/validation';

interface RouteParams {
  params: { campaignId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = params;
    const body = await request.json();
    const { accountId } = body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!isValidCampaignId(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    if (!accountId || !isValidNearAccountId(accountId)) {
      return NextResponse.json(
        { error: 'Valid NEAR account ID required' },
        { status: 401 }
      );
    }

    // ── Verify campaign exists ────────────────────────────────────────────────
    const campaign = getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // ── Verify access ─────────────────────────────────────────────────────────
    const accessRecord = getAccessRecord(accountId, campaignId);
    const expiryTimestamp = accessRecord?.expiresAt || null;
    const accessResult = checkAccess(accountId, campaignId, expiryTimestamp);

    if (!accessResult.hasAccess) {
      return NextResponse.json(
        {
          error: 'Access denied',
          reason: accessResult.reason,
          code: 'ACCESS_DENIED',
        },
        { status: 403 }
      );
    }

    // ── Fetch encrypted metadata from IPFS ────────────────────────────────────
    const metadata = await fetchMetadataFromIPFS(campaign.metadataCid);

    // ── Decrypt the video URL (server-side only) ──────────────────────────────
    // This is the wallet-gated decryption step.
    // The ENCRYPTION_MASTER_KEY never leaves the server.
    const decryptedUrl = decryptVideoUrl({
      ciphertext: metadata.encryptedVideoUrl,
      iv: metadata.iv,
      authTag: metadata.authTag,
    });

    // ── Convert to embed URL ──────────────────────────────────────────────────
    // We return the embed URL, not the raw watch URL.
    // This prevents direct download while allowing playback.
    const embedUrl = toEmbedUrl(decryptedUrl);
    if (!embedUrl) {
      console.error('[Play] Failed to generate embed URL from decrypted URL');
      return NextResponse.json(
        { error: 'Failed to generate player URL' },
        { status: 500 }
      );
    }

    // ── Issue play token ──────────────────────────────────────────────────────
    // Short-lived token (5 min) to authorize this play session.
    // The client must re-request if the token expires.
    const playToken = issuePlayToken(accountId, campaignId);

    // ── Return player configuration ───────────────────────────────────────────
    return NextResponse.json({
      success: true,
      embedUrl,
      playToken: {
        token: playToken.token,
        signature: playToken.signature,
        expiresAt: playToken.expiresAt,
      },
      access: {
        expiresAt: accessResult.expiresAt,
        remainingSeconds: accessResult.remainingSeconds,
        remainingFormatted: accessResult.expiresAt
          ? formatRemainingTime(accessResult.expiresAt)
          : null,
      },
      campaign: {
        title: campaign.title,
        creatorAccount: campaign.creatorAccount,
      },
    });
  } catch (error) {
    console.error('[API] Play endpoint error:', error);

    if (error instanceof Error && error.message.includes('auth tag')) {
      // GCM auth tag failure = tampered data
      return NextResponse.json(
        { error: 'Metadata integrity check failed. Data may be corrupted.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to initialize player' },
      { status: 500 }
    );
  }
}
