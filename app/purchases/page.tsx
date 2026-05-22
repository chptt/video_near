/**
 * PrivateStream NEAR - My Purchases Page
 * Shows all campaigns the connected wallet has purchased access to.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Play,
  Clock,
  Lock,
  Unlock,
  Loader2,
  Shield,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { useWallet } from '@/contexts/WalletContext';
import { callViewMethod } from '@/lib/near';
import { CONTRACT_NAME } from '@/lib/constants';

interface PurchasedCampaign {
  campaignId: string;
  title: string;
  description: string;
  creatorAccount: string;
  priceNear: string;
  expiresAt: number;
  hasAccess: boolean;
  remainingSeconds: number;
  metadataCid: string;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  if (m > 0) return `${m}m ${s}s remaining`;
  return `${s}s remaining`;
}

export default function PurchasesPage() {
  const router = useRouter();
  const { accountId, isSignedIn, isLoading: walletLoading, login } = useWallet();

  const [purchases, setPurchases] = useState<PurchasedCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Live countdown ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!walletLoading && isSignedIn && accountId) {
      loadPurchases();
    } else if (!walletLoading && !isSignedIn) {
      setIsLoading(false);
    }
  }, [accountId, isSignedIn, walletLoading]);

  const loadPurchases = async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      // 1. Get all campaigns from the contract
      const onChainCampaigns = await callViewMethod<Array<{
        id: string;
        creator: string;
        metadataCid: string;
        priceYocto: string;
        durationSeconds: number;
        active: boolean;
        soldOut: boolean;
      }>>('get_all_campaigns', { fromIndex: 0, limit: 50 });

      if (!Array.isArray(onChainCampaigns) || onChainCampaigns.length === 0) {
        setPurchases([]);
        return;
      }

      // 2. For each campaign, check if this wallet has access
      const results: PurchasedCampaign[] = [];

      await Promise.all(
        onChainCampaigns.map(async (c) => {
          try {
            const expiry = await callViewMethod<number>(
              'get_access_expiry',
              { accountId, campaignId: c.id }
            );

            if (!expiry || expiry === 0) return; // never purchased

            const expiresAt = Number(expiry);
            const remaining = Math.max(0, expiresAt - now);
            const hasAccess = expiresAt > now;

            // Fetch title/description from IPFS metadata
            let title = `Campaign ${c.id.slice(0, 8)}`;
            let description = '';
            try {
              const ipfsRes = await fetch(
                `https://gateway.pinata.cloud/ipfs/${c.metadataCid}`,
                { signal: AbortSignal.timeout(5000) }
              );
              if (ipfsRes.ok) {
                const meta = await ipfsRes.json();
                title = meta.title || title;
                description = meta.description || '';
              }
            } catch { /* use placeholder */ }

            results.push({
              campaignId: c.id,
              title,
              description,
              creatorAccount: c.creator,
              priceNear: (Number(c.priceYocto) / 1e24).toFixed(2),
              expiresAt,
              hasAccess,
              remainingSeconds: remaining,
              metadataCid: c.metadataCid,
            });
          } catch { /* skip this campaign */ }
        })
      );

      // Sort: active access first, then expired
      results.sort((a, b) => {
        if (a.hasAccess && !b.hasAccess) return -1;
        if (!a.hasAccess && b.hasAccess) return 1;
        return b.expiresAt - a.expiresAt;
      });

      setPurchases(results);
    } catch (err) {
      console.error('[Purchases] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!walletLoading && !isSignedIn) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-4 pt-16">
          <div className="text-center max-w-sm">
            <ShoppingBag className="w-16 h-16 text-cyan-400/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
            <p className="text-gray-400 text-sm mb-6">
              Connect your NEAR wallet to see your purchased videos.
            </p>
            <button onClick={login} className="btn-cyber-primary px-6 py-3 rounded-xl">
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading your purchases...</p>
          </div>
        </div>
      </div>
    );
  }

  const activePurchases = purchases.filter((p) => p.hasAccess);
  const expiredPurchases = purchases.filter((p) => !p.hasAccess);

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">My Purchases</h1>
              <p className="text-gray-500 text-sm font-mono">{accountId}</p>
            </div>
          </div>
          <button
            onClick={loadPurchases}
            className="btn-cyber px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </motion.div>

        {purchases.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-12 text-center border border-dashed border-cyan-500/20"
          >
            <ShoppingBag className="w-16 h-16 text-cyan-400/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Purchases Yet</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              Browse the marketplace and pay NEAR to unlock access to exclusive video content.
            </p>
            <Link href="/marketplace">
              <button className="btn-cyber-primary px-6 py-3 rounded-xl">
                Browse Marketplace
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Active Access */}
            {activePurchases.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-green-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Unlock className="w-4 h-4" />
                  Active Access ({activePurchases.length})
                </h2>
                <div className="space-y-3">
                  {activePurchases.map((p, i) => (
                    <PurchaseCard
                      key={p.campaignId}
                      purchase={p}
                      now={now}
                      index={i}
                      onWatch={() => router.push(`/watch/${p.campaignId}?expiresAt=${p.expiresAt}&metadataCid=${p.metadataCid}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Expired */}
            {expiredPurchases.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Expired ({expiredPurchases.length})
                </h2>
                <div className="space-y-3">
                  {expiredPurchases.map((p, i) => (
                    <PurchaseCard
                      key={p.campaignId}
                      purchase={p}
                      now={now}
                      index={i}
                      onWatch={() => router.push(`/campaign/${p.campaignId}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PurchaseCard({
  purchase,
  now,
  index,
  onWatch,
}: {
  purchase: PurchasedCampaign;
  now: number;
  index: number;
  onWatch: () => void;
}) {
  const remaining = Math.max(0, purchase.expiresAt - now);
  const hasAccess = remaining > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass rounded-xl p-5 border transition-all ${
        hasAccess
          ? 'border-green-500/20 hover:border-green-500/40'
          : 'border-white/5 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {hasAccess ? (
              <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                <Unlock className="w-3 h-3" /> Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                <Lock className="w-3 h-3" /> Expired
              </span>
            )}
            <span className="text-gray-600 text-xs">•</span>
            <span className="text-gray-500 text-xs">{purchase.priceNear} NEAR paid</span>
          </div>

          <h3 className="text-white font-semibold truncate">{purchase.title}</h3>

          {purchase.description && (
            <p className="text-gray-400 text-sm mt-0.5 line-clamp-1">{purchase.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <div className={`flex items-center gap-1.5 text-xs ${hasAccess ? 'text-green-400' : 'text-gray-500'}`}>
              <Clock className="w-3 h-3" />
              {hasAccess ? formatRemaining(remaining) : 'Access expired'}
            </div>
            <a
              href={`https://testnet.nearblocks.io/address/${purchase.creatorAccount}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400/60 hover:text-cyan-400 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {purchase.creatorAccount.slice(0, 20)}...
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {hasAccess ? (
            <button
              onClick={onWatch}
              className="btn-cyber-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2 whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              Watch Now
            </button>
          ) : (
            <button
              onClick={onWatch}
              className="btn-cyber px-4 py-2 rounded-lg text-sm flex items-center gap-2 whitespace-nowrap"
            >
              <Shield className="w-4 h-4" />
              Buy Again
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
