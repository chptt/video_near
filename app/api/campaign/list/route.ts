/**
 * GET /api/campaign/list
 *
 * Returns all active campaigns for the marketplace.
 * Sold-out and removed campaigns are excluded.
 *
 * Query params:
 * - page: page number (default: 1)
 * - limit: items per page (default: 12, max: 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveCampaigns, getAllCampaigns } from '@/lib/campaignRegistry';
import { calculateRevenueStatus } from '@/lib/pricing';
import { formatDuration } from '@/lib/access';

// Force dynamic rendering — this route uses request.url for query params
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12')));
    const showAll = searchParams.get('all') === 'true';

    const campaigns = showAll ? getAllCampaigns() : getActiveCampaigns();

    // Paginate
    const total = campaigns.length;
    const start = (page - 1) * limit;
    const paginated = campaigns.slice(start, start + limit);

    // Enrich with revenue status
    const enriched = await Promise.all(
      paginated.map(async (campaign) => {
        const revenueStatus = await calculateRevenueStatus(campaign.grossRevenueNear);
        return {
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
          // NOTE: metadataCid is public — it points to encrypted data
          metadataCid: campaign.metadataCid,
        };
      })
    );

    return NextResponse.json({
      campaigns: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: start + limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('[API] Campaign list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}
