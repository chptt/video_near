/**
 * POST /api/campaign/[campaignId]/purchase
 *
 * Records a purchase after the NEAR smart contract transaction is confirmed.
 * Queries the contract directly for access expiry — no registry dependency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign, registerCampaign, recordPurchase, recordPurchaseRevenue, isTransactionProcessed } from '@/lib/campaignRegistry';
import { calculatePaymentSplit } from '@/lib/pricing';
import { isValidCampaignId, isValidNearAccountId, isValidTransactionHash } from '@/lib/validation';
import { viewContract } from '@/lib/rpc';

interface RouteParams {
  params: { campaignId: string };
}

// Server-safe RPC view call — uses shared multi-endpoint utility
async function viewMethod<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
  return viewContract<T>(methodName, args);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = params;
    const body = await request.json();
    const { buyerAccount, txHash, amountNear } = body;

    if (!isValidCampaignId(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }
    if (!isValidNearAccountId(buyerAccount)) {
      return NextResponse.json({ error: 'Invalid buyer account' }, { status: 400 });
    }
    if (!isValidTransactionHash(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 });
    }
    if (isTransactionProcessed(txHash)) {
      return NextResponse.json({ error: 'Transaction already processed', code: 'DUPLICATE_TX' }, { status: 409 });
    }

    // ── Get campaign — hydrate from chain if not in registry ─────────────────
    let campaign = getCampaign(campaignId);
    if (!campaign) {
      try {
        const onChain = await viewMethod<{
          id: string; creator: string; metadataCid: string;
          priceYocto: string; durationSeconds: number;
          grossRevenueYocto: string; purchaseCount: number;
          active: boolean; soldOut: boolean; createdAt: number; updatedAt: number;
        } | null>('get_campaign', { campaignId });

        if (onChain) {
          campaign = {
            id: onChain.id,
            creatorAccount: onChain.creator,
            metadataCid: onChain.metadataCid,
            title: `Campaign ${onChain.id.slice(0, 8)}`,
            description: '',
            priceNear: (Number(onChain.priceYocto) / 1e24).toFixed(4).replace(/\.?0+$/, ''),
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
      } catch (e) {
        console.warn('[Purchase] Could not hydrate campaign from chain:', e);
      }
    }

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // ── Get actual access expiry from the contract ────────────────────────────
    let expiresAt: number;
    try {
      const onChainExpiry = await viewMethod<number>(
        'get_access_expiry',
        { accountId: buyerAccount, campaignId }
      );
      expiresAt = Number(onChainExpiry);
    } catch {
      // Fallback: calculate from now + duration
      expiresAt = Math.floor(Date.now() / 1000) + campaign.durationSeconds;
    }

    if (!expiresAt || expiresAt === 0) {
      expiresAt = Math.floor(Date.now() / 1000) + campaign.durationSeconds;
    }

    const purchasedAt = Math.floor(Date.now() / 1000);
    const paymentAmount = amountNear || campaign.priceNear;

    // ── Record purchase ───────────────────────────────────────────────────────
    recordPurchase({ campaignId, buyerAccount, txHash, amountNear: paymentAmount, purchasedAt, expiresAt });

    const split = await calculatePaymentSplit(paymentAmount);
    const updatedCampaign = recordPurchaseRevenue(campaignId, paymentAmount, split.totalUsd);

    return NextResponse.json({
      success: true,
      campaignId,
      buyerAccount,
      expiresAt,
      accessDurationSeconds: campaign.durationSeconds,
      paymentSplit: {
        totalNear: split.totalNear,
        totalUsd: split.totalUsd,
        creatorNear: split.creatorNear,
        platformNear: split.platformNear,
      },
      campaignStatus: {
        soldOut: updatedCampaign?.soldOut || false,
        grossRevenueUsd: updatedCampaign?.grossRevenueUsd || 0,
      },
    });
  } catch (error) {
    console.error('[API] Purchase record error:', error);
    return NextResponse.json({ error: 'Failed to record purchase' }, { status: 500 });
  }
}
