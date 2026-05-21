/**
 * NEAR RPC Proxy
 *
 * Forwards JSON-RPC requests to reliable testnet RPC endpoints.
 * Tries multiple upstreams in order until one succeeds.
 */

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM_RPCS = [
  'https://testnet.rpc.fastnear.com',
  'https://near-testnet.lava.build',
  'https://rpc.testnet.pagoda.co',
  'https://testnet.nearrpc.com',
];

export async function POST(request: NextRequest) {
  const body = await request.text();
  let lastError: string = 'All RPC endpoints failed';

  for (const rpc of UPSTREAM_RPCS) {
    try {
      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        // 10 second timeout per upstream
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        lastError = `${rpc} returned ${response.status}`;
        continue;
      }

      const data = await response.text();

      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-RPC-Upstream': rpc,
        },
      });
    } catch (err) {
      lastError = `${rpc}: ${err instanceof Error ? err.message : String(err)}`;
      console.warn('[RPC Proxy] Upstream failed, trying next:', lastError);
      continue;
    }
  }

  console.error('[RPC Proxy] All upstreams failed:', lastError);
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code: -32603, message: lastError }, id: null },
    { status: 502 }
  );
}

export async function GET() {
  return NextResponse.json({
    status: 'NEAR RPC proxy active',
    upstreams: UPSTREAM_RPCS,
  });
}
