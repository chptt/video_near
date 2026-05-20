/**
 * PrivateStream NEAR - Countdown Timer
 * Shows remaining access time with live countdown.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: number; // Unix timestamp in seconds
  onExpired?: () => void;
  compact?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeLeft(expiresAt: number): TimeLeft {
  const now = Math.floor(Date.now() / 1000);
  const total = Math.max(0, expiresAt - now);

  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    total,
  };
}

export function CountdownTimer({ expiresAt, onExpired, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(expiresAt);
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.total === 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const isExpired = timeLeft.total === 0;
  const isUrgent = timeLeft.total < 3600; // Less than 1 hour

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 text-red-400">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-medium">Access Expired</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${isUrgent ? 'text-yellow-400' : 'text-cyan-400'}`}>
        <Clock className="w-3.5 h-3.5" />
        <span className="text-xs font-mono font-medium">
          {timeLeft.days > 0 && `${timeLeft.days}d `}
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className={`w-4 h-4 ${isUrgent ? 'text-yellow-400' : 'text-cyan-400'}`} />
        <span className="text-sm font-medium text-gray-300">Access Expires In</span>
        {isUrgent && (
          <span className="badge-sold-out text-xs">Expiring Soon</span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { value: timeLeft.days, label: 'Days' },
          { value: timeLeft.hours, label: 'Hours' },
          { value: timeLeft.minutes, label: 'Min' },
          { value: timeLeft.seconds, label: 'Sec' },
        ].map(({ value, label }) => (
          <motion.div
            key={label}
            className={`text-center p-3 rounded-lg ${
              isUrgent ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-cyan-500/10 border border-cyan-500/20'
            }`}
          >
            <motion.div
              key={value}
              initial={{ scale: 1.2, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-2xl font-bold font-mono ${isUrgent ? 'text-yellow-400' : 'text-cyan-400'}`}
            >
              {String(value).padStart(2, '0')}
            </motion.div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
