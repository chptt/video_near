/**
 * GET /api/campaign/[campaignId]
 *
 * Returns public campaign details by ID.
 * Does NOT return encrypted video URL — that requires access verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign } from '@/lib/campaignRegistry';
import { calculateRevenueStatus } from '@/lib/pricing';
import { formatDuration } from '@/lib/access';
import { isValidCampaignId } from '@/lib/validation';

interface RouteParams {
  params: { campaignId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = params;

    if (!isValidCampaignId(campaignId)) {
      return NextResponse.json(
        { error: 'Invalid campaign ID format' },
        { status: 400 }
      );
    }

    const campaign = getCampaign(campaignId);

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const revenueStatus = await calculateRevenueStatus(campaign.grossRevenueNear);

    return NextResponse.json({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      creatorAccount: campaign.creatorAccount,
      priceNear: campaign.priceNear,
      durationSeconds: campaign.durationSeconds,
      durationFormatted: formatDuration(campaign.durationSeconds),
      purchaseCount: campaign.purchaseCount,
      grossRevenueUsd: revenueStatus.grossRevenueUsd,
      remainingCapUsd: revenueStatus.remainingCapUsd,
      percentageFilled: revenueStatus.percentageFilled,
      soldOut: campaign.soldOut,
      active: campaign.active,
      createdAt: campaign.createdAt,
      metadataCid: campaign.metadataCid,
    });
  } catch (error) {
    console.error('[API] Campaign get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}
