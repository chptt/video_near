/**
 * GET /api/campaign/list
 *
 * Returns all active campaigns for the marketplace.
 * Queries the NEAR smart contract directly as source of truth,
 * falling back to the in-memory registry if the contract is unreachable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveCampaigns, getAllCampaigns, registerCampaign } from '@/lib/campaignRegistry';
import { calculateRevenueStatus } from '@/lib/pricing';
import { formatDuration } from '@/lib/access';
import { viewContract } from '@/lib/rpc';

export const dynamic = 'force-dynamic';

// Server-safe RPC call
async function viewMethod<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
  return viewContract<T>(methodName, args);
}

interface OnChainCampaign {
  id: string;
  creator: string;
  metadataCid: string;
  priceYocto: string;
  durationSeconds: number;
  grossRevenueYocto: string;
  purchaseCount: number;
  active: boolean;
  soldOut: boolean;
  createdAt: number;
  updatedAt: number;
}

async function hydrateFromChain(): Promise<boolean> {
  try {
    const onChainCampaigns = await viewMethod<OnChainCampaign[]>(
      'get_all_campaigns',
      { fromIndex: 0, limit: 50 }
    );

    if (!Array.isArray(onChainCampaigns) || onChainCampaigns.length === 0) return false;

    for (const c of onChainCampaigns) {
      const priceNear = (BigInt(c.priceYocto) / BigInt('1000000000000000000000000')).toString() ||
        (Number(c.priceYocto) / 1e24).toFixed(4);

      registerCampaign({
        id: c.id,
        creatorAccount: c.creator,
        metadataCid: c.metadataCid,
        title: `Campaign ${c.id.slice(0, 8)}`,   // title lives in IPFS, use placeholder
        description: '',
        priceNear,
        durationSeconds: Number(c.durationSeconds),
        grossRevenueNear: (Number(c.grossRevenueYocto) / 1e24).toFixed(6),
        grossRevenueUsd: 0,
        purchaseCount: Number(c.purchaseCount),
        active: c.active,
        soldOut: c.soldOut,
        createdAt: Number(c.createdAt),
        updatedAt: Number(c.updatedAt),
      });
    }
    return true;
  } catch (err) {
    console.warn('[Campaign List] Could not hydrate from chain:', err);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12')));
    const showAll = searchParams.get('all') === 'true';

    // If registry is empty (cold start), hydrate from the contract
    const registryCampaigns = showAll ? getAllCampaigns() : getActiveCampaigns();
    if (registryCampaigns.length === 0) {
      await hydrateFromChain();
    }

    const campaigns = showAll ? getAllCampaigns() : getActiveCampaigns();
    const total = campaigns.length;
    const start = (page - 1) * limit;
    const paginated = campaigns.slice(start, start + limit);

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
