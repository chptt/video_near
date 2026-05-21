/**
 * PrivateStream NEAR - Purchase Button
 * Handles the full purchase flow: wallet check → contract call → access grant.
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@/contexts/WalletContext';
import { CONTRACT_NAME } from '@/lib/constants';

interface PurchaseButtonProps {
  campaignId: string;
  priceNear: string;
  soldOut: boolean;
  onSuccess?: (expiresAt: number) => void;
}

type PurchaseState = 'idle' | 'connecting' | 'purchasing' | 'verifying' | 'success' | 'error';

export function PurchaseButton({
  campaignId,
  priceNear,
  soldOut,
  onSuccess,
}: PurchaseButtonProps) {
  const { accountId, isSignedIn, login } = useWallet();
  const [state, setPurchaseState] = useState<PurchaseState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

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
      setPurchaseState('purchasing');
      setErrorMessage('');

      // Dynamically import near wallet selector
      const { callChangeMethod } = await import('@/lib/near');
      const { nearToYocto } = await import('@/lib/near');

      // Convert NEAR price to yoctoNEAR
      const yoctoAmount = nearToYocto(priceNear);

      // Get wallet from selector
      const selectorInstance = (window as unknown as { __nearSelector?: { wallet: () => Promise<{ signAndSendTransaction: (args: unknown) => Promise<{ transaction?: { hash?: string } }> }> } }).__nearSelector;
      if (!selectorInstance) throw new Error('Wallet not connected');

      const wallet = await selectorInstance.wallet();
      const result = await wallet.signAndSendTransaction({
        receiverId: process.env.NEXT_PUBLIC_CONTRACT_NAME || 'privatestream.chandanapt.testnet',
        actions: [{
          type: 'FunctionCall',
          params: {
            methodName: 'purchase_access',
            args: { campaignId },
            gas: '30000000000000',
            deposit: yoctoAmount,
          },
        }],
      });

      setPurchaseState('verifying');

      // Extract transaction hash from result
      const txHash = (result as { transaction?: { hash?: string } })?.transaction?.hash;

      if (txHash && accountId) {
        // Record purchase on backend
        const response = await fetch(`/api/campaign/${campaignId}/purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerAccount: accountId,
            txHash,
            amountNear: priceNear,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setPurchaseState('success');
          toast.success('Access granted! You can now watch the video.');
          onSuccess?.(data.expiresAt);
        } else {
          // Purchase was on-chain but backend recording failed
          // Access is still valid via contract
          setPurchaseState('success');
          toast.success('Purchase successful! Refreshing access...');
          onSuccess?.(Math.floor(Date.now() / 1000) + 86400);
        }
      } else {
        // Transaction submitted but no hash yet (async)
        setPurchaseState('success');
        toast.success('Transaction submitted! Access will be available shortly.');
        onSuccess?.(Math.floor(Date.now() / 1000) + 86400);
      }
    } catch (error) {
      console.error('[Purchase] Error:', error);
      setPurchaseState('error');

      const message =
        error instanceof Error ? error.message : 'Purchase failed. Please try again.';

      if (message.includes('User rejected')) {
        setErrorMessage('Transaction cancelled by user');
        toast.error('Transaction cancelled');
      } else if (message.includes('insufficient')) {
        setErrorMessage('Insufficient NEAR balance');
        toast.error('Insufficient NEAR balance');
      } else {
        setErrorMessage(message);
        toast.error('Purchase failed. Please try again.');
      }

      // Reset to idle after error
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

  const isLoading = ['connecting', 'purchasing', 'verifying'].includes(state);

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
