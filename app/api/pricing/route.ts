/**
 * GET /api/pricing
 *
 * Returns current NEAR/USD price and platform fee configuration.
 * Used by the frontend for price display and revenue calculations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNearUsdPrice } from '@/lib/pricing';
import {
  PLATFORM_FEE_PERCENTAGE,
  CREATOR_PERCENTAGE,
  REVENUE_CAP_USD,
} from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const priceData = await getNearUsdPrice();

    return NextResponse.json({
      nearUsd: priceData.nearUsd,
      priceSource: priceData.source,
      priceTimestamp: priceData.timestamp,
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      creatorPercentage: CREATOR_PERCENTAGE,
      revenueCapUsd: REVENUE_CAP_USD,
    });
  } catch (error) {
    console.error('[API] Pricing error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing data' },
      { status: 500 }
    );
  }
}
