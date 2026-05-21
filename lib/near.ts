/**
 * PrivateStream NEAR - NEAR Protocol Integration
 * Uses @near-wallet-selector for wallet connections.
 */

'use client';

import { CONTRACT_NAME, NEAR_NETWORK } from './constants';

export const TESTNET_RPC = 'https://rpc.testnet.near.org';

// ─── Contract Interactions ────────────────────────────────────────────────────

/**
 * Calls a change method on the smart contract via wallet selector.
 */
export async function callChangeMethod(
  methodName: string,
  args: Record<string, unknown>,
  depositYocto: string = '0',
  gas: string = '30000000000000'
): Promise<unknown> {
  const selectorInstance = ((window as unknown) as Record<string, unknown>).__nearSelector as {
    wallet: () => Promise<{
      signAndSendTransaction: (args: {
        receiverId: string;
        actions: Array<{
          type: 'FunctionCall';
          params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string };
        }>;
      }) => Promise<unknown>;
    }>;
  } | undefined;

  if (!selectorInstance) throw new Error('Wallet not connected');

  const wallet = await selectorInstance.wallet();
  return wallet.signAndSendTransaction({
    receiverId: CONTRACT_NAME,
    actions: [
      {
        type: 'FunctionCall',
        params: { methodName, args, gas, deposit: depositYocto },
      },
    ],
  });
}

/**
 * Calls a view method on the smart contract (read-only, no gas).
 */
export async function callViewMethod<T>(
  methodName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(TESTNET_RPC, {
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
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return JSON.parse(Buffer.from(data.result.result).toString()) as T;
}

// ─── NEAR Unit Conversion ─────────────────────────────────────────────────────

export function nearToYocto(nearAmount: string): string {
  const [whole, decimal = ''] = nearAmount.split('.');
  const paddedDecimal = decimal.padEnd(24, '0').slice(0, 24);
  const yocto = BigInt(whole) * (10n ** 24n) + BigInt(paddedDecimal || '0');
  return yocto.toString();
}

export function yoctoToNear(yoctoAmount: string): string {
  if (!yoctoAmount || yoctoAmount === '0') return '0';
  try {
    const yocto = BigInt(yoctoAmount);
    const divisor = 10n ** 24n;
    const whole = yocto / divisor;
    const remainder = yocto % divisor;
    if (remainder === 0n) return whole.toString();
    const decimal = remainder.toString().padStart(24, '0').replace(/0+$/, '');
    return `${whole}.${decimal}`;
  } catch { return '0'; }
}

export function formatNear(yoctoAmount: string): string {
  const near = parseFloat(yoctoToNear(yoctoAmount));
  if (isNaN(near)) return '0 NEAR';
  return `${near.toFixed(4).replace(/\.?0+$/, '')} NEAR`;
}

// ─── Transaction Verification ─────────────────────────────────────────────────

export async function verifyTransaction(
  txHash: string,
  accountId: string
): Promise<{ success: boolean; receiverId?: string; deposit?: string; methodName?: string }> {
  try {
    const response = await fetch(TESTNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'dontcare',
        method: 'tx',
        params: [txHash, accountId],
      }),
    });
    const data = await response.json();
    if (data.error || !data.result) return { success: false };
    const tx = data.result;
    if (!tx.status?.SuccessValue && !tx.status?.SuccessReceiptId) return { success: false };
    const actions = tx.transaction?.actions || [];
    const fc = actions.find((a: Record<string, unknown>) => 'FunctionCall' in a);
    if (fc?.FunctionCall) {
      return {
        success: true,
        receiverId: tx.transaction?.receiver_id,
        deposit: fc.FunctionCall.deposit,
        methodName: fc.FunctionCall.method_name,
      };
    }
    return { success: true };
  } catch { return { success: false }; }
}

// ─── Legacy exports ───────────────────────────────────────────────────────────
export async function loginWithNearWallet() {}
export async function logoutNearWallet() {}
export async function getWalletState() { return { accountId: null, isSignedIn: false }; }
export async function getAccountBalance() { return '0'; }
export function getNearConfig() {
  return {
    networkId: NEAR_NETWORK,
    nodeUrl: TESTNET_RPC,
    walletUrl: 'https://wallet.testnet.near.org',
    helperUrl: '',
    explorerUrl: 'https://testnet.nearblocks.io',
  };
}
