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
import { CONTRACT_NAME, NEAR_NODE_URL } from '@/lib/constants';

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
  const rpc = NEAR_NODE_URL || 'https://test.rpc.fastnear.com';
  const response = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'dontcare',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: CONTRACT_NAME,
        method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return JSON.parse(Buffer.from(data.result.result).toString()) as T;
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
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}
