/**
 * GET /api/campaign/[campaignId]/access
 *
 * Checks if a wallet has valid access to a campaign.
 * Returns access status and expiry without decrypting the video.
 *
 * Query params:
 * - accountId: NEAR account ID to check
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign, getAccessRecord } from '@/lib/campaignRegistry';
import { checkAccess, formatRemainingTime } from '@/lib/access';
import { isValidCampaignId, isValidNearAccountId } from '@/lib/validation';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { campaignId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = params;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!isValidCampaignId(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    if (!accountId || !isValidNearAccountId(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const campaign = getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check access record from registry
    const accessRecord = getAccessRecord(accountId, campaignId);
    const expiryTimestamp = accessRecord?.expiresAt || null;

    const accessResult = checkAccess(accountId, campaignId, expiryTimestamp);

    return NextResponse.json({
      hasAccess: accessResult.hasAccess,
      expiresAt: accessResult.expiresAt || null,
      remainingSeconds: accessResult.remainingSeconds || 0,
      remainingFormatted: accessResult.expiresAt
        ? formatRemainingTime(accessResult.expiresAt)
        : null,
      reason: accessResult.reason || null,
      campaignActive: campaign.active,
      campaignSoldOut: campaign.soldOut,
    });
  } catch (error) {
    console.error('[API] Access check error:', error);
    return NextResponse.json(
      { error: 'Failed to check access' },
      { status: 500 }
    );
  }
}
