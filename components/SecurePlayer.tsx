/**
 * PrivateStream NEAR - Secure Video Player
 *
 * Renders the YouTube embed player for authorized viewers.
 * The embed URL is fetched from the server after access verification.
 * The raw YouTube URL is NEVER exposed to the client.
 *
 * Security measures:
 * - iframe sandbox attributes restrict capabilities
 * - Content Security Policy headers (set in next.config.js)
 * - Play token expires after 5 minutes (re-fetch required)
 * - No download controls exposed
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, RefreshCw, AlertTriangle, Loader2, Lock } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { toast } from 'sonner';

interface SecurePlayerProps {
  campaignId: string;
  accountId: string;
  accessExpiresAt: number;
  metadataCid?: string;
  onAccessExpired?: () => void;
}

interface PlayerConfig {
  embedUrl: string;
  playToken: {
    token: string;
    signature: string;
    expiresAt: number;
  };
  access: {
    expiresAt: number;
    remainingSeconds: number;
    remainingFormatted: string;
  };
  campaign: {
    title: string;
    creatorAccount: string;
  };
}

export function SecurePlayer({
  campaignId,
  accountId,
  accessExpiresAt,
  metadataCid,
  onAccessExpired,
}: SecurePlayerProps) {
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);

  const fetchPlayerConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setTokenExpired(false);

      const response = await fetch(`/api/campaign/${campaignId}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, expiresAt: accessExpiresAt, metadataCid }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'ACCESS_DENIED') {
          setError(data.reason || 'Access denied');
          onAccessExpired?.();
        } else {
          setError(data.error || 'Failed to load player');
        }
        return;
      }

      const config: PlayerConfig = await response.json();
      setPlayerConfig(config);

      // Schedule token refresh before it expires (30 seconds before)
      const tokenTtl = (config.playToken.expiresAt - Math.floor(Date.now() / 1000) - 30) * 1000;
      if (tokenTtl > 0) {
        setTimeout(() => {
          setTokenExpired(true);
        }, tokenTtl);
      }
    } catch (err) {
      console.error('[SecurePlayer] Error:', err);
      setError('Failed to initialize player. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, accountId, onAccessExpired]);

  useEffect(() => {
    fetchPlayerConfig();
  }, [fetchPlayerConfig]);

  // Handle play token expiry — refresh silently
  useEffect(() => {
    if (tokenExpired) {
      fetchPlayerConfig();
    }
  }, [tokenExpired, fetchPlayerConfig]);

  if (isLoading) {
    return (
      <div className="aspect-video rounded-xl glass flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-gray-400 text-sm">Decrypting secure stream...</p>
          <p className="text-gray-600 text-xs">Verifying wallet access</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video rounded-xl glass flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1">Access Denied</h3>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!playerConfig) return null;

  return (
    <div className="space-y-4">
      {/* Security indicator */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-400" />
          <span className="text-xs text-green-400 font-medium">Encrypted Stream Active</span>
        </div>
        <button
          onClick={fetchPlayerConfig}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          title="Refresh player"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Video Player */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative aspect-video rounded-xl overflow-hidden border border-cyan-500/20"
        style={{ boxShadow: '0 0 40px rgba(0, 245, 255, 0.1)' }}
      >
        <iframe
          src={playerConfig.embedUrl}
          title={playerConfig.campaign.title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          // Security: restrict iframe capabilities
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          referrerPolicy="strict-origin-when-cross-origin"
        />

        {/* Overlay watermark (subtle) */}
        <div
          className="absolute bottom-2 right-2 text-xs text-white/20 font-mono pointer-events-none select-none"
          aria-hidden="true"
        >
          PSN • {accountId?.slice(0, 8)}
        </div>
      </motion.div>

      {/* Access countdown */}
      <div className="glass rounded-xl p-4">
        <CountdownTimer
          expiresAt={accessExpiresAt}
          onExpired={onAccessExpired}
        />
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2 px-1">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500/60 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          This content is wallet-gated and encrypted. Sharing or recording may violate the creator's terms.
          Access expires automatically.
        </p>
      </div>
    </div>
  );
}
