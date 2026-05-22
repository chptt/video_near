/**
 * GET /api/campaign/[campaignId]/access
 *
 * Checks if a wallet has valid access to a campaign.
 * Queries the NEAR contract directly — no registry dependency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatRemainingTime } from '@/lib/access';
import { isValidCampaignId, isValidNearAccountId } from '@/lib/validation';
import { viewContract } from '@/lib/rpc';

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

    // Query contract directly for campaign existence and access expiry
    let campaignActive = true;
    let campaignSoldOut = false;

    try {
      const onChain = await viewContract<{
        active: boolean; soldOut: boolean;
      } | null>('get_campaign', { campaignId });

      if (!onChain) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      campaignActive = onChain.active;
      campaignSoldOut = onChain.soldOut;
    } catch (e) {
      console.warn('[Access] Could not verify campaign on chain:', e);
      // Continue — don't block access check if campaign query fails
    }

    // Get access expiry directly from contract
    let expiresAt: number | null = null;
    try {
      const onChainExpiry = await viewContract<number>(
        'get_access_expiry',
        { accountId, campaignId }
      );
      if (onChainExpiry && Number(onChainExpiry) > 0) {
        expiresAt = Number(onChainExpiry);
      }
    } catch (e) {
      console.warn('[Access] Could not get access expiry from chain:', e);
    }

    const now = Math.floor(Date.now() / 1000);
    const hasAccess = expiresAt !== null && expiresAt > now;
    const remainingSeconds = hasAccess ? expiresAt! - now : 0;

    return NextResponse.json({
      hasAccess,
      expiresAt: expiresAt || null,
      remainingSeconds,
      remainingFormatted: expiresAt && hasAccess
        ? formatRemainingTime(expiresAt)
        : null,
      reason: !hasAccess
        ? (expiresAt ? 'Access has expired' : 'No purchase record found')
        : null,
      campaignActive,
      campaignSoldOut,
    });
  } catch (error) {
    console.error('[API] Access check error:', error);
    return NextResponse.json({ error: 'Failed to check access' }, { status: 500 });
  }
}
