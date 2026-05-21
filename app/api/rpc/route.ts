/**
 * NEAR RPC Proxy
 *
 * Forwards JSON-RPC requests to a reliable testnet RPC endpoint.
 * This bypasses the hardcoded rpc.testnet.near.org inside wallet packages
 * (e.g. Meteor Wallet) that fail with ERR_CONNECTION_CLOSED.
 *
 * Usage: point NEXT_PUBLIC_NEAR_NODE_URL to /api/rpc
 */

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM_RPC = 'https://testnet.rpc.fastnear.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const response = await fetch(UPSTREAM_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[RPC Proxy] Error:', error);
    return NextResponse.json(
      { error: { code: -32603, message: 'RPC proxy error' } },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'NEAR RPC proxy active', upstream: UPSTREAM_RPC });
}
