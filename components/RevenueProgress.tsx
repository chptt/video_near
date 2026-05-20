/**
 * PrivateStream NEAR - Revenue Progress Bar
 * Animated progress bar showing campaign revenue vs $20 cap.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp } from 'lucide-react';
import { REVENUE_CAP_USD } from '@/lib/constants';

interface RevenueProgressProps {
  grossRevenueUsd: number;
  percentageFilled: number;
  compact?: boolean;
  showDetails?: boolean;
}

export function RevenueProgress({
  grossRevenueUsd,
  percentageFilled,
  compact = false,
  showDetails = false,
}: RevenueProgressProps) {
  const remaining = Math.max(0, REVENUE_CAP_USD - grossRevenueUsd);
  const isSoldOut = percentageFilled >= 100;

  // Color based on fill percentage
  const getProgressColor = () => {
    if (isSoldOut) return 'from-pink-500 to-red-500';
    if (percentageFilled >= 75) return 'from-yellow-500 to-orange-500';
    if (percentageFilled >= 50) return 'from-cyan-500 to-purple-500';
    return 'from-cyan-400 to-cyan-600';
  };

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Revenue Cap</span>
          <span className="text-xs text-gray-400">
            ${grossRevenueUsd.toFixed(2)} / ${REVENUE_CAP_USD}
          </span>
        </div>
        <div className="progress-cyber">
          <motion.div
            className={`progress-cyber-fill bg-gradient-to-r ${getProgressColor()}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percentageFilled)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">Revenue Progress</span>
        </div>
        <span
          className={`text-sm font-bold ${
            isSoldOut ? 'text-pink-400' : 'text-cyan-400'
          }`}
        >
          {percentageFilled.toFixed(1)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="progress-cyber h-3">
          <motion.div
            className={`progress-cyber-fill bg-gradient-to-r ${getProgressColor()} h-full`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percentageFilled)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>

        {/* Glow effect */}
        {!isSoldOut && (
          <motion.div
            className="absolute top-0 h-3 rounded-full opacity-50 blur-sm bg-gradient-to-r from-cyan-400 to-cyan-600"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percentageFilled)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        )}
      </div>

      {/* Stats */}
      {showDetails && (
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-white/3">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-green-400" />
              <span className="text-white font-bold text-sm">
                ${grossRevenueUsd.toFixed(2)}
              </span>
            </div>
            <span className="text-gray-500 text-xs">Earned</span>
          </div>

          <div className="text-center p-3 rounded-lg bg-white/3">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-white font-bold text-sm">
                ${REVENUE_CAP_USD}
              </span>
            </div>
            <span className="text-gray-500 text-xs">Cap</span>
          </div>

          <div className="text-center p-3 rounded-lg bg-white/3">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-white font-bold text-sm">
                ${remaining.toFixed(2)}
              </span>
            </div>
            <span className="text-gray-500 text-xs">Remaining</span>
          </div>
        </div>
      )}

      {isSoldOut && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-pink-500/10 border border-pink-500/20">
          <span className="text-pink-400 text-sm font-medium">
            Revenue cap reached — Campaign sold out
          </span>
        </div>
      )}
    </div>
  );
}
