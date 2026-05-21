/**
 * NEAR RPC Proxy
 *
 * Forwards JSON-RPC requests to reliable testnet RPC endpoints.
 * Tries multiple upstreams in order until one succeeds.
 *
 * Sources: https://docs.near.org/api/rpc/providers
 */

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM_RPCS = [
  'https://test.rpc.fastnear.com',       // FastNEAR testnet (official)
  'https://near-testnet.drpc.org',        // dRPC testnet
  'https://testnet-rpc.intea.rs',         // Intear RPC testnet
];

export async function POST(request: NextRequest) {
  const body = await request.text();
  const errors: string[] = [];

  for (const rpc of UPSTREAM_RPCS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        errors.push(`${rpc} → HTTP ${response.status}`);
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
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${rpc} → ${msg}`);
      console.warn('[RPC Proxy] Upstream failed:', rpc, msg);
    }
  }

  console.error('[RPC Proxy] All upstreams failed:', errors);
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      error: { code: -32603, message: `All RPC upstreams failed: ${errors.join(' | ')}` },
      id: null,
    },
    { status: 502 }
  );
}

export async function GET() {
  return NextResponse.json({
    status: 'NEAR RPC proxy active',
    upstreams: UPSTREAM_RPCS,
  });
}
