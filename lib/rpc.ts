/**
 * Server-side NEAR RPC utility.
 * Tries multiple endpoints with fallback — safe to use in API routes.
 * Do NOT import this in client components ('use client' files).
 */

import { CONTRACT_NAME } from './constants';

const RPCS = [
  'https://test.rpc.fastnear.com',
  'https://near-testnet.drpc.org',
  'https://testnet-rpc.intea.rs',
];

async function rpcPost(url: string, body: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls a view method on the PrivateStream contract.
 * Tries multiple RPC endpoints until one succeeds.
 */
export async function viewContract<T>(
  methodName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: methodName,
    method: 'query',
    params: {
      request_type: 'call_function',
      finality: 'final',
      account_id: CONTRACT_NAME,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
    },
  });

  const errors: string[] = [];

  for (const rpc of RPCS) {
    try {
      const res = await rpcPost(rpc, body);
      if (!res.ok) {
        errors.push(`${rpc} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data.error) {
        errors.push(`${rpc}: ${data.error.message || JSON.stringify(data.error)}`);
        continue;
      }
      return JSON.parse(Buffer.from(data.result.result).toString()) as T;
    } catch (err) {
      errors.push(`${rpc}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`All RPC endpoints failed for ${methodName}: ${errors.join(' | ')}`);
}
