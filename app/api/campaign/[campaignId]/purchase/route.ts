/**
 * POST /api/campaign/[campaignId]/purchase
 *
 * Records a purchase after the NEAR smart contract transaction is confirmed.
 * This is called AFTER the on-chain transaction succeeds.
 *
 * Flow:
 * 1. Frontend calls NEAR contract purchase_access()
 * 2. Contract records access expiry and splits payment
 * 3. Frontend calls this endpoint with the tx hash
 * 4. Backend verifies the transaction on-chain
 * 5. Backend records the purchase in the registry
 * 6. Returns access confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign, recordPurchase, recordPurchaseRevenue, isTransactionProcessed } from '@/lib/campaignRegistry';
import { verifyTransaction } from '@/lib/near';
import { calculatePaymentSplit, wouldExceedRevenueCap } from '@/lib/pricing';
import { isValidCampaignId, isValidNearAccountId, isValidTransactionHash } from '@/lib/validation';
import { CONTRACT_NAME } from '@/lib/constants';

interface RouteParams {
  params: { campaignId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = params;
    const body = await request.json();
    const { buyerAccount, txHash, amountNear } = body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!isValidCampaignId(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    if (!isValidNearAccountId(buyerAccount)) {
      return NextResponse.json({ error: 'Invalid buyer account' }, { status: 400 });
    }

    if (!isValidTransactionHash(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 });
    }

    // ── Replay attack prevention ──────────────────────────────────────────────
    if (isTransactionProcessed(txHash)) {
      return NextResponse.json(
        { error: 'Transaction already processed', code: 'DUPLICATE_TX' },
        { status: 409 }
      );
    }

    // ── Verify campaign exists ────────────────────────────────────────────────
    const campaign = getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // ── Verify transaction on NEAR blockchain ─────────────────────────────────
    const txVerification = await verifyTransaction(txHash, buyerAccount);

    if (!txVerification.success) {
      return NextResponse.json(
        { error: 'Transaction verification failed. Please ensure the transaction was confirmed.' },
        { status: 400 }
      );
    }

    // Verify the transaction was sent to the correct contract
    if (txVerification.receiverId && txVerification.receiverId !== CONTRACT_NAME) {
      return NextResponse.json(
        { error: 'Transaction was not sent to the PrivateStream contract' },
        { status: 400 }
      );
    }

    // ── Calculate payment split ───────────────────────────────────────────────
    const paymentAmount = amountNear || campaign.priceNear;
    const split = await calculatePaymentSplit(paymentAmount);

    // ── Calculate access expiry ───────────────────────────────────────────────
    const purchasedAt = Math.floor(Date.now() / 1000);
    const expiresAt = purchasedAt + campaign.durationSeconds;

    // ── Record purchase ───────────────────────────────────────────────────────
    recordPurchase({
      campaignId,
      buyerAccount,
      txHash,
      amountNear: paymentAmount,
      purchasedAt,
      expiresAt,
    });

    // ── Update campaign revenue ───────────────────────────────────────────────
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
    return NextResponse.json(
      { error: 'Failed to record purchase' },
      { status: 500 }
    );
  }
}
