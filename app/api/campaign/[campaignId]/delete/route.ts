/**
 * DELETE /api/campaign/[campaignId]/delete
 *
 * Removes a campaign from the in-memory registry.
 * The on-chain deletion must be done separately via the contract's
 * delete_campaign method (called from the frontend with the creator's wallet).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign } from '@/lib/campaignRegistry';
import { isValidCampaignId } from '@/lib/validation';

// Simple admin secret check — set ADMIN_SECRET in env
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'privatestream-admin';

interface RouteParams {
  params: { campaignId: string };
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = params;
    const secret = request.headers.get('x-admin-secret');

    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isValidCampaignId(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    const campaign = getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found in registry' }, { status: 404 });
    }

    // Remove from in-memory registry by importing the maps directly
    // We do this by re-exporting a clear function from the registry
    const { clearCampaign } = await import('@/lib/campaignRegistry');
    clearCampaign(campaignId, campaign.creatorAccount);

    return NextResponse.json({ success: true, campaignId });
  } catch (error) {
    console.error('[API] Campaign delete error:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
