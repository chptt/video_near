/**
 * PrivateStream NEAR - Campaign Detail Page
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Users,
  Shield,
  Lock,
  Unlock,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { PurchaseButton } from '@/components/PurchaseButton';
import { RevenueProgress } from '@/components/RevenueProgress';
import { AccessBadge } from '@/components/AccessBadge';
import { useWallet } from '@/contexts/WalletContext';
import { formatDuration } from '@/lib/access';
import { REVENUE_CAP_USD } from '@/lib/constants';

interface CampaignDetail {
  id: string;
  title: string;
  description: string;
  creatorAccount: string;
  priceNear: string;
  priceYocto?: string;
  durationSeconds: number;
  durationFormatted: string;
  purchaseCount: number;
  grossRevenueUsd: number;
  remainingCapUsd: number;
  percentageFilled: number;
  soldOut: boolean;
  active: boolean;
  createdAt: number;
  metadataCid: string;
}

interface AccessStatus {
  hasAccess: boolean;
  expiresAt?: number;
  remainingSeconds?: number;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;
  const { accountId, isSignedIn } = useWallet();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearUsd, setNearUsd] = useState(5);

  useEffect(() => {
    fetchCampaign();
    fetch('/api/pricing').then(r => r.json()).then(d => setNearUsd(d.nearUsd || 5)).catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    if (accountId && campaign) {
      checkAccess();
    }
  }, [accountId, campaign]);

  const fetchCampaign = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/campaign/${campaignId}`);
      if (!response.ok) {
        if (response.status === 404) setError('Campaign not found');
        else setError('Failed to load campaign');
        return;
      }
      const data = await response.json();
      setCampaign(data);
    } catch {
      setError('Failed to load campaign');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAccess = async () => {
    if (!accountId) return;
    try {
      const response = await fetch(
        `/api/campaign/${campaignId}/access?accountId=${accountId}`
      );
      if (response.ok) {
        const data = await response.json();
        setAccessStatus(data);
      }
    } catch {
      // Ignore
    }
  };

  const handlePurchaseSuccess = (expiresAt: number) => {
    setAccessStatus({ hasAccess: true, expiresAt, remainingSeconds: campaign?.durationSeconds });
    fetchCampaign(); // Refresh revenue data
  };

  // ...existing code...

  // ── Purchase or Watch button ──────────────────────────────────────────────
  // After purchase, navigate with expiresAt so the watch page doesn't depend
  // on the in-memory registry (which resets on serverless cold starts).
  const handleWatchNow = () => {
    const params = accessStatus?.expiresAt
      ? `?expiresAt=${accessStatus.expiresAt}`
      : '';
    router.push(`/watch/${campaignId}${params}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-4 pt-16">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || 'Campaign not found'}</p>
            <Link href="/marketplace" className="btn-cyber px-6 py-2 rounded-lg text-sm">
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const priceUsd = parseFloat(campaign.priceNear) * nearUsd;

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Back */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-6"
            >
              {/* Status */}
              <div className="flex items-center justify-between mb-4">
                {campaign.soldOut ? (
                  <span className="badge-sold-out">Sold Out</span>
                ) : accessStatus?.hasAccess ? (
                  <AccessBadge expiresAt={accessStatus.expiresAt} />
                ) : (
                  <span className="badge-active">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Active
                  </span>
                )}

                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  AES-256-GCM Encrypted
                </div>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-white mb-2">{campaign.title}</h1>

              {/* Creator */}
              <p className="text-sm text-gray-500 mb-4">
                by{' '}
                <a
                  href={`https://testnet.nearblocks.io/address/${campaign.creatorAccount}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  {campaign.creatorAccount}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>

              {/* Description */}
              <p className="text-gray-300 leading-relaxed">{campaign.description}</p>
            </motion.div>

            {/* Revenue Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <RevenueProgress
                grossRevenueUsd={campaign.grossRevenueUsd}
                percentageFilled={campaign.percentageFilled}
                showDetails
              />
            </motion.div>

            {/* IPFS Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                Decentralized Storage
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">IPFS CID</span>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${campaign.metadataCid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                  >
                    {campaign.metadataCid.slice(0, 20)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-gray-600">
                  Encrypted metadata stored on IPFS. Video URL is AES-256-GCM encrypted — only verified buyers can decrypt.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Purchase card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-strong rounded-2xl p-6 border border-cyan-500/20"
            >
              {/* Price */}
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-white mb-1">
                  {campaign.priceNear}
                  <span className="text-xl text-gray-400 ml-1">NEAR</span>
                </div>
                <div className="text-gray-500 text-sm">≈ ${priceUsd.toFixed(2)} USD</div>
              </div>

              {/* Stats */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="w-4 h-4" />
                    Access Duration
                  </div>
                  <span className="text-white font-medium">{campaign.durationFormatted}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="w-4 h-4" />
                    Total Buyers
                  </div>
                  <span className="text-white font-medium">{campaign.purchaseCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    {accessStatus?.hasAccess ? (
                      <Unlock className="w-4 h-4 text-green-400" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    Your Access
                  </div>
                  <span className={accessStatus?.hasAccess ? 'text-green-400 font-medium' : 'text-gray-500'}>
                    {accessStatus?.hasAccess ? 'Active' : 'None'}
                  </span>
                </div>
              </div>

              {/* Purchase or Watch button */}
              {accessStatus?.hasAccess ? (
                <button
                  onClick={handleWatchNow}
                  className="w-full btn-cyber-primary py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  Watch Now
                </button>
              ) : (
                <PurchaseButton
                  campaignId={campaignId}
                  priceNear={campaign.priceNear}
                  priceYocto={campaign.priceYocto}
                  soldOut={campaign.soldOut}
                  onSuccess={handlePurchaseSuccess}
                />
              )}

              {/* Revenue cap warning */}
              {campaign.remainingCapUsd < 5 && !campaign.soldOut && (
                <p className="text-center text-xs text-yellow-400 mt-3">
                  ⚡ Only ${campaign.remainingCapUsd.toFixed(2)} remaining before sold out
                </p>
              )}
            </motion.div>

            {/* Security info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-xl p-4"
            >
              <h4 className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                Security Model
              </h4>
              <ul className="space-y-2 text-xs text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  Video URL encrypted with AES-256-GCM
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  Decryption only after wallet verification
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  Access enforced by NEAR smart contract
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  Play tokens expire after 5 minutes
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
