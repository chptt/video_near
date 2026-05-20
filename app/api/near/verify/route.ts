/**
 * POST /api/near/verify
 *
 * Verifies a NEAR transaction hash on-chain.
 * Used to confirm payments before granting access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/near';
import { isValidTransactionHash, isValidNearAccountId } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txHash, accountId } = body;

    if (!isValidTransactionHash(txHash)) {
      return NextResponse.json(
        { error: 'Invalid transaction hash format' },
        { status: 400 }
      );
    }

    if (!isValidNearAccountId(accountId)) {
      return NextResponse.json(
        { error: 'Invalid NEAR account ID' },
        { status: 400 }
      );
    }

    const result = await verifyTransaction(txHash, accountId);

    return NextResponse.json({
      verified: result.success,
      receiverId: result.receiverId,
      deposit: result.deposit,
      methodName: result.methodName,
    });
  } catch (error) {
    console.error('[API] NEAR verify error:', error);
    return NextResponse.json(
      { error: 'Transaction verification failed' },
      { status: 500 }
    );
  }
}
