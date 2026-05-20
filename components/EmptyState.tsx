/**
 * PrivateStream NEAR - Empty State Component
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      {/* Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center">
          <Icon className="w-10 h-10 text-cyan-400/60" />
        </div>
        <div className="absolute inset-0 blur-xl bg-cyan-400/10 rounded-2xl" />
      </div>

      {/* Text */}
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-6">
        {description}
      </p>

      {/* Action */}
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="btn-cyber-primary px-6 py-2.5 rounded-lg text-sm font-medium"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="btn-cyber-primary px-6 py-2.5 rounded-lg text-sm font-medium"
          >
            {actionLabel}
          </button>
        )
      )}
    </motion.div>
  );
}
