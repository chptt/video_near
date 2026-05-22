/**
 * GET /api/campaign/[campaignId]
 *
 * Returns public campaign details by ID.
 * Queries the NEAR smart contract directly as source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign, registerCampaign } from '@/lib/campaignRegistry';
import { calculateRevenueStatus } from '@/lib/pricing';
import { formatDuration } from '@/lib/access';
import { isValidCampaignId } from '@/lib/validation';
import { viewContract } from '@/lib/rpc';

interface RouteParams {
  params: { campaignId: string };
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

async function viewMethod<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
  return viewContract<T>(methodName, args);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = params;

    if (!isValidCampaignId(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID format' }, { status: 400 });
    }

    // Try registry first, then fall back to on-chain
    let campaign = getCampaign(campaignId);

    if (!campaign) {
      // Query contract directly
      try {
        const onChain = await viewMethod<OnChainCampaign | null>('get_campaign', { campaignId });
        if (onChain) {
          const priceNear = (Number(onChain.priceYocto) / 1e24).toFixed(4).replace(/\.?0+$/, '');
          campaign = {
            id: onChain.id,
            creatorAccount: onChain.creator,
            metadataCid: onChain.metadataCid,
            title: `Campaign ${onChain.id.slice(0, 8)}`,
            description: '',
            priceNear,
            durationSeconds: Number(onChain.durationSeconds),
            grossRevenueNear: (Number(onChain.grossRevenueYocto) / 1e24).toFixed(6),
            grossRevenueUsd: 0,
            purchaseCount: Number(onChain.purchaseCount),
            active: onChain.active,
            soldOut: onChain.soldOut,
            createdAt: Number(onChain.createdAt),
            updatedAt: Number(onChain.updatedAt),
          };
          registerCampaign(campaign);
        }
      } catch (err) {
        console.warn('[Campaign GET] Contract query failed:', err);
      }
    }

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get exact priceYocto from contract for accurate purchase amounts
    let priceYocto: string | null = null;
    try {
      const onChainFresh = await viewMethod<{ priceYocto: string } | null>('get_campaign', { campaignId });
      priceYocto = onChainFresh?.priceYocto || null;
    } catch { /* non-critical */ }

    const revenueStatus = await calculateRevenueStatus(campaign.grossRevenueNear);

    return NextResponse.json({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      creatorAccount: campaign.creatorAccount,
      priceNear: campaign.priceNear,
      priceYocto,
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
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}
