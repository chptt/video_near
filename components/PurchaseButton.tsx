/**
 * PrivateStream NEAR - Purchase Button
 *
 * Handles the full purchase flow: wallet check → contract call → access grant.
 *
 * WALLET REDIRECT HANDLING:
 * MyNearWallet uses a redirect-based signing flow. We save the campaignId to
 * localStorage before the redirect so the campaign page can detect the return
 * via ?transactionHashes= and grant access without re-calling the contract.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@/contexts/WalletContext';
import { callViewMethod } from '@/lib/near';

const PENDING_PURCHASE_KEY = 'ps_pending_purchase';

interface PendingPurchase {
  campaignId: string;
  priceNear: string;
  timestamp: number;
}

interface PurchaseButtonProps {
  campaignId: string;
  priceNear: string;
  soldOut: boolean;
  onSuccess?: (expiresAt: number) => void;
}

type PurchaseState = 'idle' | 'connecting' | 'checking' | 'purchasing' | 'verifying' | 'success' | 'error';

export function PurchaseButton({
  campaignId,
  priceNear,
  soldOut,
  onSuccess,
}: PurchaseButtonProps) {
  const { accountId, isSignedIn, login, selector } = useWallet();
  const [state, setPurchaseState] = useState<PurchaseState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // ── Detect return from wallet redirect ────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const txHashes = urlParams.get('transactionHashes');
    const errorCode = urlParams.get('errorCode');

    const raw = localStorage.getItem(PENDING_PURCHASE_KEY);
    if (!raw) return;

    let pending: PendingPurchase;
    try {
      pending = JSON.parse(raw);
    } catch {
      localStorage.removeItem(PENDING_PURCHASE_KEY);
      return;
    }

    // Only handle if this button's campaignId matches the pending purchase
    if (pending.campaignId !== campaignId) return;

    // Stale pending (older than 10 minutes) — ignore
    if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
      localStorage.removeItem(PENDING_PURCHASE_KEY);
      return;
    }

    localStorage.removeItem(PENDING_PURCHASE_KEY);

    if (errorCode) {
      setPurchaseState('error');
      setErrorMessage('Transaction cancelled by wallet');
      toast.error('Transaction cancelled');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (txHashes && accountId) {
      // Transaction confirmed — record purchase on backend
      setPurchaseState('verifying');
      window.history.replaceState({}, '', window.location.pathname);

      const txHash = txHashes.split(',')[0];
      recordPurchaseOnBackend(txHash, pending.campaignId, pending.priceNear);
    }
  }, [campaignId, accountId]);

  const recordPurchaseOnBackend = async (
    txHash: string,
    cId: string,
    price: string
  ) => {
    if (!accountId) return;
    try {
      const response = await fetch(`/api/campaign/${cId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerAccount: accountId,
          txHash,
          amountNear: price,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPurchaseState('success');
        toast.success('Access granted! You can now watch the video.');
        onSuccess?.(data.expiresAt);
      } else {
        // On-chain purchase succeeded but backend recording failed
        // Grant access with estimated expiry
        setPurchaseState('success');
        toast.success('Purchase successful! Access granted.');
        onSuccess?.(Math.floor(Date.now() / 1000) + 86400);
      }
    } catch {
      setPurchaseState('success');
      toast.success('Purchase successful! Access granted.');
      onSuccess?.(Math.floor(Date.now() / 1000) + 86400);
    }
  };

  const handlePurchase = async () => {
    if (!isSignedIn) {
      toast.info('Please connect your NEAR wallet first');
      await login();
      return;
    }

    if (soldOut) {
      toast.error('This campaign has reached its revenue cap');
      return;
    }

    try {
      setPurchaseState('checking');
      setErrorMessage('');

      // ── Verify campaign exists on-chain before paying ─────────────────────
      // This prevents the "Campaign not found" contract panic.
      let onChainCampaign: { active?: boolean; soldOut?: boolean } | null = null;
      try {
        onChainCampaign = await callViewMethod<{ active: boolean; soldOut: boolean } | null>(
          'get_campaign',
          { campaignId }
        );
      } catch {
        // RPC error — proceed anyway, contract will validate
      }

      if (onChainCampaign === null) {
        setPurchaseState('error');
        setErrorMessage('Campaign not found on-chain. It may still be processing.');
        toast.error('Campaign not found on-chain. Please wait a moment and try again.');
        setTimeout(() => setPurchaseState('idle'), 4000);
        return;
      }

      if (onChainCampaign.soldOut) {
        setPurchaseState('error');
        setErrorMessage('Campaign is sold out');
        toast.error('This campaign has sold out');
        setTimeout(() => setPurchaseState('idle'), 3000);
        return;
      }

      if (!onChainCampaign.active) {
        setPurchaseState('error');
        setErrorMessage('Campaign is no longer active');
        toast.error('This campaign is no longer active');
        setTimeout(() => setPurchaseState('idle'), 3000);
        return;
      }

      setPurchaseState('purchasing');

      const { callChangeMethod, nearToYocto } = await import('@/lib/near');
      const yoctoAmount = nearToYocto(priceNear);

      // ── Save pending purchase before wallet redirect ───────────────────────
      const pending: PendingPurchase = {
        campaignId,
        priceNear,
        timestamp: Date.now(),
      };
      localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(pending));

      const result = await callChangeMethod(
        'purchase_access',
        { campaignId },
        yoctoAmount,
        '30000000000000',
        selector ?? undefined
      );

      // Reached here = popup/async wallet (Meteor, Sender) — no redirect
      localStorage.removeItem(PENDING_PURCHASE_KEY);
      setPurchaseState('verifying');

      const txHash = (result as { transaction?: { hash?: string } })?.transaction?.hash;

      if (txHash && accountId) {
        await recordPurchaseOnBackend(txHash, campaignId, priceNear);
      } else {
        setPurchaseState('success');
        toast.success('Transaction submitted! Access will be available shortly.');
        onSuccess?.(Math.floor(Date.now() / 1000) + 86400);
      }
    } catch (error) {
      console.error('[Purchase] Error:', error);
      localStorage.removeItem(PENDING_PURCHASE_KEY);
      setPurchaseState('error');

      const message =
        error instanceof Error ? error.message : 'Purchase failed. Please try again.';

      if (message.includes('User rejected') || message.includes('user rejected')) {
        setErrorMessage('Transaction cancelled by user');
        toast.error('Transaction cancelled');
      } else if (message.includes('insufficient') || message.includes('Insufficient')) {
        setErrorMessage('Insufficient NEAR balance');
        toast.error('Insufficient NEAR balance');
      } else {
        setErrorMessage(message);
        toast.error('Purchase failed. Please try again.');
      }

      setTimeout(() => setPurchaseState('idle'), 3000);
    }
  };

  if (soldOut) {
    return (
      <div className="w-full py-3 px-6 rounded-xl bg-gray-800/50 border border-gray-700 text-gray-500 text-center font-medium cursor-not-allowed">
        Campaign Sold Out
      </div>
    );
  }

  const isLoading = ['connecting', 'checking', 'purchasing', 'verifying'].includes(state);

  return (
    <div className="space-y-2">
      <motion.button
        whileHover={!isLoading ? { scale: 1.02 } : {}}
        whileTap={!isLoading ? { scale: 0.98 } : {}}
        onClick={handlePurchase}
        disabled={isLoading || state === 'success'}
        className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
          state === 'success'
            ? 'bg-green-500/20 border border-green-500/30 text-green-400 cursor-default'
            : isLoading
            ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400/60 cursor-wait'
            : 'btn-cyber-primary'
        }`}
      >
        {state === 'success' ? (
          <>
            <CheckCircle className="w-4 h-4" />
            Access Granted
          </>
        ) : state === 'checking' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying Campaign...
          </>
        ) : state === 'purchasing' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Confirm in Wallet...
          </>
        ) : state === 'verifying' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying Transaction...
          </>
        ) : !isSignedIn ? (
          <>
            <Zap className="w-4 h-4" />
            Connect Wallet to Purchase
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay {priceNear} NEAR to Unlock
          </>
        )}
      </motion.button>

      {state === 'error' && errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-red-400 text-xs px-1"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {errorMessage}
        </motion.div>
      )}

      {!isSignedIn && (
        <p className="text-center text-xs text-gray-500">
          Connect your NEAR wallet to purchase access
        </p>
      )}
    </div>
  );
}
