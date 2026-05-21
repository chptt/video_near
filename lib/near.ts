/**
 * PrivateStream NEAR - NEAR Protocol Integration
 *
 * Handles wallet connection, account management, and contract interactions
 * using near-api-js. Designed for Next.js App Router (client-side only).
 */

'use client';

import {
  NEAR_NETWORK,
  NEAR_NODE_URL,
  NEAR_WALLET_URL,
  NEAR_HELPER_URL,
  CONTRACT_NAME,
  APP_URL,
} from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearConfig {
  networkId: string;
  nodeUrl: string;
  walletUrl: string;
  helperUrl: string;
  explorerUrl: string;
}

export interface WalletState {
  accountId: string | null;
  isSignedIn: boolean;
}

// ─── NEAR Configuration ───────────────────────────────────────────────────────

export function getNearConfig(): NearConfig {
  return {
    networkId: NEAR_NETWORK,
    nodeUrl: NEAR_NODE_URL,
    walletUrl: NEAR_WALLET_URL,
    helperUrl: NEAR_HELPER_URL,
    explorerUrl:
      NEAR_NETWORK === 'mainnet'
        ? 'https://nearblocks.io'
        : 'https://testnet.nearblocks.io',
  };
}

// ─── Dynamic NEAR API Loading ─────────────────────────────────────────────────
// near-api-js must be loaded client-side only due to browser-specific APIs

let nearApiJs: typeof import('near-api-js') | null = null;

async function getNearApi() {
  if (!nearApiJs) {
    nearApiJs = await import('near-api-js');
  }
  return nearApiJs;
}

// ─── Wallet Connection ────────────────────────────────────────────────────────

/**
 * Initializes the NEAR wallet connection.
 * Returns the WalletConnection instance for use in components.
 */
export async function initNearWallet() {
  const near = await getNearApi();
  const config = getNearConfig();

  const nearConnection = await near.connect({
    networkId: config.networkId,
    nodeUrl: config.nodeUrl,
    walletUrl: config.walletUrl,
    helperUrl: config.helperUrl,
    headers: {},
  });

  const keyStore = new near.keyStores.BrowserLocalStorageKeyStore();
  const nearWithKeyStore = await near.connect({
    ...config,
    keyStore,
    headers: {},
  });

  const wallet = new near.WalletConnection(nearWithKeyStore, 'privatestream-near');
  return { wallet, near: nearWithKeyStore };
}

/**
 * Redirects user to NEAR Wallet for login.
 * After approval, redirects back to the app with account credentials.
 */
export async function loginWithNearWallet(): Promise<void> {
  const { wallet } = await initNearWallet();
  // near-api-js v4 uses a simplified requestSignIn
  await wallet.requestSignIn({
    contractId: CONTRACT_NAME,
    successUrl: `${APP_URL}/dashboard`,
    failureUrl: `${APP_URL}/connect`,
  } as Parameters<typeof wallet.requestSignIn>[0]);
}

/**
 * Signs out the current NEAR wallet user.
 */
export async function logoutNearWallet(): Promise<void> {
  const { wallet } = await initNearWallet();
  wallet.signOut();
  // Clear any cached state
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

/**
 * Returns the currently connected NEAR account ID, or null if not connected.
 */
export async function getConnectedAccount(): Promise<string | null> {
  try {
    const { wallet } = await initNearWallet();
    if (wallet.isSignedIn()) {
      return wallet.getAccountId();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the current wallet sign-in state.
 */
export async function getWalletState(): Promise<WalletState> {
  try {
    const { wallet } = await initNearWallet();
    const isSignedIn = wallet.isSignedIn();
    return {
      accountId: isSignedIn ? wallet.getAccountId() : null,
      isSignedIn,
    };
  } catch {
    return { accountId: null, isSignedIn: false };
  }
}

// ─── Account Queries ──────────────────────────────────────────────────────────

/**
 * Fetches the NEAR balance for an account in yoctoNEAR.
 */
export async function getAccountBalance(accountId: string): Promise<string> {
  try {
    const near = await getNearApi();
    const config = getNearConfig();
    const keyStore = new near.keyStores.BrowserLocalStorageKeyStore();

    const nearConnection = await near.connect({
      ...config,
      keyStore,
      headers: {},
    });

    const account = await nearConnection.account(accountId);
    const balance = await account.getAccountBalance();
    return balance.available;
  } catch {
    return '0';
  }
}

// ─── Contract Interactions ────────────────────────────────────────────────────

/**
 * Calls a view method on the smart contract (read-only, no gas).
 */
export async function callViewMethod<T>(
  methodName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const near = await getNearApi();
  const config = getNearConfig();
  const keyStore = new near.keyStores.BrowserLocalStorageKeyStore();

  const nearConnection = await near.connect({
    ...config,
    keyStore,
    headers: {},
  });

  const account = await nearConnection.account(CONTRACT_NAME);
  return account.viewFunction({
    contractId: CONTRACT_NAME,
    methodName,
    args,
  }) as Promise<T>;
}

/**
 * Calls a change method on the smart contract (requires gas + potential deposit).
 */
export async function callChangeMethod(
  methodName: string,
  args: Record<string, unknown>,
  depositYocto: string = '0',
  gas: string = '30000000000000'
): Promise<unknown> {
  const { wallet } = await initNearWallet();

  if (!wallet.isSignedIn()) {
    throw new Error('Wallet not connected');
  }

  const account = wallet.account();
  return account.functionCall({
    contractId: CONTRACT_NAME,
    methodName,
    args,
    gas: BigInt(gas),
    attachedDeposit: BigInt(depositYocto),
  });
}

// ─── NEAR Unit Conversion ─────────────────────────────────────────────────────

/**
 * Converts NEAR amount (as string) to yoctoNEAR BigInt string.
 * Example: "1.5" NEAR → "1500000000000000000000000"
 */
export function nearToYocto(nearAmount: string): string {
  // Use near-api-js if already loaded
  if (nearApiJs) {
    return nearApiJs.utils.format.parseNearAmount(nearAmount) || '0';
  }
  // Fallback manual calculation
  const [whole, decimal = ''] = nearAmount.split('.');
  const paddedDecimal = decimal.padEnd(24, '0').slice(0, 24);
  const yocto = BigInt(whole) * (10n ** 24n) + BigInt(paddedDecimal);
  return yocto.toString();
}

/**
 * Converts yoctoNEAR string to human-readable NEAR amount.
 * Example: "1500000000000000000000000" → "1.5"
 */
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
  } catch {
    return '0';
  }
}

/**
 * Formats a NEAR amount for display (max 4 decimal places).
 */
export function formatNear(yoctoAmount: string): string {
  const near = parseFloat(yoctoToNear(yoctoAmount));
  if (isNaN(near)) return '0 NEAR';
  return `${near.toFixed(4).replace(/\.?0+$/, '')} NEAR`;
}

// ─── Transaction Verification ─────────────────────────────────────────────────

/**
 * Verifies a NEAR transaction by hash using the RPC API.
 * Used server-side to confirm payment before granting access.
 */
export async function verifyTransaction(
  txHash: string,
  accountId: string
): Promise<{
  success: boolean;
  receiverId?: string;
  deposit?: string;
  methodName?: string;
}> {
  try {
    const response = await fetch('https://testnet.rpc.fastnear.com', {
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

    if (data.error || !data.result) {
      return { success: false };
    }

    const tx = data.result;
    const status = tx.status;

    // Check if transaction succeeded
    if (!status?.SuccessValue && !status?.SuccessReceiptId) {
      return { success: false };
    }

    // Extract action details
    const actions = tx.transaction?.actions || [];
    const functionCall = actions.find(
      (a: Record<string, unknown>) => 'FunctionCall' in a
    );

    if (functionCall?.FunctionCall) {
      const fc = functionCall.FunctionCall;
      return {
        success: true,
        receiverId: tx.transaction?.receiver_id,
        deposit: fc.deposit,
        methodName: fc.method_name,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[NEAR] Transaction verification failed:', error);
    return { success: false };
  }
}
