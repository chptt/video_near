/**
 * PrivateStream NEAR - Creator Dashboard
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  Plus,
  ExternalLink,
  Loader2,
  Play,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { RevenueProgress } from '@/components/RevenueProgress';
import { useWallet } from '@/contexts/WalletContext';
import {
  PLATFORM_FEE_PERCENTAGE,
  CREATOR_PERCENTAGE,
  REVENUE_CAP_USD,
} from '@/lib/constants';

interface CampaignStats {
  id: string;
  title: string;
  description: string;
  priceNear: string;
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

export default function DashboardPage() {
  const router = useRouter();
  const { accountId, isSignedIn, isLoading: walletLoading, login } = useWallet();

  const [campaign, setCampaign] = useState<CampaignStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nearUsd, setNearUsd] = useState(5);

  useEffect(() => {
    if (!walletLoading && isSignedIn && accountId) {
      fetchDashboardData();
    } else if (!walletLoading && !isSignedIn) {
      setIsLoading(false);
    }
  }, [accountId, isSignedIn, walletLoading]);

  const fetchDashboardData = async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const [campaignRes, pricingRes] = await Promise.all([
        fetch(`/api/campaign/list?all=true`),
        fetch('/api/pricing'),
      ]);

      if (pricingRes.ok) {
        const pricing = await pricingRes.json();
        setNearUsd(pricing.nearUsd || 5);
      }

      if (campaignRes.ok) {
        const data = await campaignRes.json();
        const myCampaign = data.campaigns?.find(
          (c: CampaignStats & { creatorAccount: string }) => c.creatorAccount === accountId
        );
        setCampaign(myCampaign || null);
      }
    } catch {
      // Ignore
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
            <Shield className="w-16 h-16 text-cyan-400/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
            <p className="text-gray-400 text-sm mb-6">
              Connect your NEAR wallet to view your creator dashboard.
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
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  const creatorEarningsUsd = campaign
    ? campaign.grossRevenueUsd * (CREATOR_PERCENTAGE / 100)
    : 0;
  const platformFeesUsd = campaign
    ? campaign.grossRevenueUsd * (PLATFORM_FEE_PERCENTAGE / 100)
    : 0;

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Creator Dashboard</h1>
              <p className="text-gray-500 text-sm font-mono">{accountId}</p>
            </div>
          </div>

          {!campaign && (
            <Link href="/campaign/create">
              <motion.button
                whileHover={{ scale: 1.02 }}
                className="btn-cyber-primary px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Create Campaign
              </motion.button>
            </Link>
          )}
        </motion.div>

        {/* No campaign state */}
        {!campaign ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-12 text-center border border-dashed border-cyan-500/20"
          >
            <Shield className="w-16 h-16 text-cyan-400/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Campaign Yet</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              Create your first encrypted video campaign. Each NEAR account can create one campaign.
            </p>
            <Link href="/campaign/create">
              <button className="btn-cyber-primary px-6 py-3 rounded-xl flex items-center gap-2 mx-auto">
                <Plus className="w-4 h-4" />
                Create Your Campaign
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Campaign header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {campaign.soldOut ? (
                      <span className="badge-sold-out">Sold Out</span>
                    ) : (
                      <span className="badge-active">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white">{campaign.title}</h2>
                  <p className="text-gray-400 text-sm mt-1 truncate-2">{campaign.description}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Link href={`/campaign/${campaign.id}`}>
                    <button className="btn-cyber px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                      View
                    </button>
                  </Link>
                </div>
              </div>

              {/* IPFS CID */}
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Shield className="w-3.5 h-3.5 text-cyan-400/50" />
                <span>IPFS: </span>
                <a
                  href={`https://gateway.pinata.cloud/ipfs/${campaign.metadataCid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400/60 hover:text-cyan-400 font-mono flex items-center gap-1"
                >
                  {campaign.metadataCid.slice(0, 24)}...
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>

            {/* Stats grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {[
                {
                  icon: DollarSign,
                  label: 'Gross Revenue',
                  value: `$${campaign.grossRevenueUsd.toFixed(2)}`,
                  sub: `of $${REVENUE_CAP_USD} cap`,
                  color: 'text-green-400',
                  bg: 'bg-green-500/10',
                  border: 'border-green-500/20',
                },
                {
                  icon: TrendingUp,
                  label: 'Your Earnings',
                  value: `$${creatorEarningsUsd.toFixed(2)}`,
                  sub: `${CREATOR_PERCENTAGE}% of revenue`,
                  color: 'text-cyan-400',
                  bg: 'bg-cyan-500/10',
                  border: 'border-cyan-500/20',
                },
                {
                  icon: Users,
                  label: 'Total Buyers',
                  value: campaign.purchaseCount.toString(),
                  sub: `at ${campaign.priceNear} NEAR each`,
                  color: 'text-purple-400',
                  bg: 'bg-purple-500/10',
                  border: 'border-purple-500/20',
                },
                {
                  icon: Shield,
                  label: 'Platform Fees',
                  value: `$${platformFeesUsd.toFixed(2)}`,
                  sub: `${PLATFORM_FEE_PERCENTAGE}% commission`,
                  color: 'text-yellow-400',
                  bg: 'bg-yellow-500/10',
                  border: 'border-yellow-500/20',
                },
              ].map(({ icon: Icon, label, value, sub, color, bg, border }) => (
                <div key={label} className={`glass rounded-xl p-5 border ${border}`}>
                  <div className={`w-9 h-9 rounded-lg ${bg} border ${border} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4.5 h-4.5 ${color}`} />
                  </div>
                  <div className={`text-2xl font-bold ${color} mb-0.5`}>{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
                </div>
              ))}
            </motion.div>

            {/* Revenue Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <RevenueProgress
                grossRevenueUsd={campaign.grossRevenueUsd}
                percentageFilled={campaign.percentageFilled}
                showDetails
              />
            </motion.div>

            {/* Sold out notice */}
            {campaign.soldOut && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-xl p-4 border border-yellow-500/20 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium text-sm">Campaign Sold Out</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Your campaign has reached the ${REVENUE_CAP_USD} revenue cap. No new purchases are accepted.
                    Existing buyers retain access until their access expires.
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
