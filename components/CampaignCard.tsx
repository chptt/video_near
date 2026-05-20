/**
 * PrivateStream NEAR - Campaign Card Component
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Users, DollarSign, Lock, Zap } from 'lucide-react';
import { RevenueProgress } from './RevenueProgress';
import { AccessBadge } from './AccessBadge';
import { REVENUE_CAP_USD } from '@/lib/constants';

export interface CampaignCardData {
  id: string;
  title: string;
  description: string;
  creatorAccount: string;
  priceNear: string;
  durationFormatted: string;
  purchaseCount: number;
  grossRevenueUsd: number;
  remainingCapUsd: number;
  percentageFilled: number;
  soldOut: boolean;
  active: boolean;
  createdAt: number;
  hasAccess?: boolean;
  accessExpiresAt?: number;
}

interface CampaignCardProps {
  campaign: CampaignCardData;
  index?: number;
}

export function CampaignCard({ campaign, index = 0 }: CampaignCardProps) {
  const truncateAccount = (id: string) =>
    id.length > 20 ? `${id.slice(0, 10)}...${id.slice(-6)}` : id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="card-cyber group cursor-pointer"
    >
      <Link href={`/campaign/${campaign.id}`} className="block">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-base leading-tight truncate group-hover:text-cyan-300 transition-colors">
              {campaign.title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 inline-block" />
              {truncateAccount(campaign.creatorAccount)}
            </p>
          </div>

          <div className="ml-3 flex-shrink-0">
            {campaign.soldOut ? (
              <span className="badge-sold-out">Sold Out</span>
            ) : campaign.hasAccess ? (
              <AccessBadge expiresAt={campaign.accessExpiresAt} />
            ) : (
              <span className="badge-active">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Active
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm truncate-2 mb-4 leading-relaxed">
          {campaign.description}
        </p>

        {/* Revenue Progress */}
        <div className="mb-4">
          <RevenueProgress
            grossRevenueUsd={campaign.grossRevenueUsd}
            percentageFilled={campaign.percentageFilled}
            compact
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-white/3">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span className="text-white font-semibold text-sm">{campaign.priceNear}</span>
            </div>
            <span className="text-gray-500 text-xs">NEAR</span>
          </div>

          <div className="text-center p-2 rounded-lg bg-white/3">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Clock className="w-3 h-3 text-purple-400" />
              <span className="text-white font-semibold text-xs">{campaign.durationFormatted}</span>
            </div>
            <span className="text-gray-500 text-xs">Access</span>
          </div>

          <div className="text-center p-2 rounded-lg bg-white/3">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Users className="w-3 h-3 text-pink-400" />
              <span className="text-white font-semibold text-sm">{campaign.purchaseCount}</span>
            </div>
            <span className="text-gray-500 text-xs">Buyers</span>
          </div>
        </div>

        {/* CTA */}
        <div
          className={`w-full py-2.5 rounded-lg text-center text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            campaign.soldOut
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : campaign.hasAccess
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:bg-cyan-500/20'
              : 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/20 group-hover:from-cyan-500/30 group-hover:to-purple-500/30'
          }`}
        >
          {campaign.soldOut ? (
            <>Sold Out</>
          ) : campaign.hasAccess ? (
            <>
              <Zap className="w-3.5 h-3.5" />
              Watch Now
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              Unlock Access
            </>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
