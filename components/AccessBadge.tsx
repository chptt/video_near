/**
 * PrivateStream NEAR - Access Badge
 * Shows access status with expiry countdown.
 */

'use client';

import React from 'react';
import { Unlock, Clock } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';

interface AccessBadgeProps {
  expiresAt?: number;
  compact?: boolean;
}

export function AccessBadge({ expiresAt, compact = true }: AccessBadgeProps) {
  if (!expiresAt) {
    return (
      <span className="badge-access">
        <Unlock className="w-3 h-3" />
        Access
      </span>
    );
  }

  const isExpired = Math.floor(Date.now() / 1000) > expiresAt;

  if (isExpired) {
    return (
      <span className="badge-sold-out">
        <Clock className="w-3 h-3" />
        Expired
      </span>
    );
  }

  if (compact) {
    return (
      <div className="badge-access">
        <Unlock className="w-3 h-3" />
        <CountdownTimer expiresAt={expiresAt} compact />
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Unlock className="w-4 h-4 text-cyan-400" />
        <span className="text-cyan-400 font-medium text-sm">Access Granted</span>
      </div>
      <CountdownTimer expiresAt={expiresAt} />
    </div>
  );
}
