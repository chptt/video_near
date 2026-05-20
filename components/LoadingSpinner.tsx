/**
 * PrivateStream NEAR - Loading Spinner
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'md', text, fullScreen = false }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <motion.div
          className={`${sizeMap[size]} rounded-full border-2 border-cyan-500/20`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            borderTopColor: '#00f5ff',
            borderRightColor: '#bf00ff',
          }}
        />
        <div
          className={`absolute inset-0 ${sizeMap[size]} rounded-full blur-sm opacity-50`}
          style={{ background: 'radial-gradient(circle, #00f5ff22, transparent)' }}
        />
      </div>
      {text && (
        <p className="text-gray-400 text-sm animate-pulse">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * Skeleton card for loading states
 */
export function CampaignCardSkeleton() {
  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex justify-between">
        <div className="space-y-2 flex-1">
          <div className="skeleton h-5 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full ml-3" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
      </div>
      <div className="skeleton h-2 w-full rounded-full" />
      <div className="grid grid-cols-3 gap-2">
        <div className="skeleton h-14 rounded-lg" />
        <div className="skeleton h-14 rounded-lg" />
        <div className="skeleton h-14 rounded-lg" />
      </div>
      <div className="skeleton h-10 w-full rounded-lg" />
    </div>
  );
}
