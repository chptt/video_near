/**
 * PrivateStream NEAR - Watch Page
 * Secure video player for authorized buyers.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { SecurePlayer } from '@/components/SecurePlayer';
import { useWallet } from '@/contexts/WalletContext';

interface AccessStatus {
  hasAccess: boolean;
  expiresAt?: number;
  remainingSeconds?: number;
  reason?: string;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = params.campaignId as string;
  const { accountId, isSignedIn, isLoading: walletLoading, login } = useWallet();

  // expiresAt passed from campaign page after purchase (avoids cold-start registry miss)
  const expiresAtParam = searchParams.get('expiresAt');

  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [metadataCid, setMetadataCid] = useState<string>('');

  useEffect(() => {
    if (!walletLoading) {
      if (!isSignedIn) {
        setIsCheckingAccess(false);
      } else if (accountId) {
        checkAccess();
      }
    }
  }, [accountId, isSignedIn, walletLoading]);

  const checkAccess = async () => {
    if (!accountId) return;
    setIsCheckingAccess(true);
    try {
      const [accessRes, campaignRes] = await Promise.all([
        fetch(`/api/campaign/${campaignId}/access?accountId=${accountId}`),
        fetch(`/api/campaign/${campaignId}`),
      ]);

      if (accessRes.ok) {
        const data = await accessRes.json();

        // If the registry returned no access but we have a fresh expiresAt from
        // the purchase redirect, trust it (serverless cold-start registry miss).
        if (!data.hasAccess && expiresAtParam) {
          const expiresAt = parseInt(expiresAtParam, 10);
          const now = Math.floor(Date.now() / 1000);
          if (expiresAt > now) {
            setAccessStatus({
              hasAccess: true,
              expiresAt,
              remainingSeconds: expiresAt - now,
            });
            if (campaignRes.ok) {
              const campaign = await campaignRes.json();
              setCampaignTitle(campaign.title);
              setMetadataCid(campaign.metadataCid || '');
            }
            return;
          }
        }

        setAccessStatus(data);
      }

      if (campaignRes.ok) {
        const campaign = await campaignRes.json();
        setCampaignTitle(campaign.title);
        setMetadataCid(campaign.metadataCid || '');
      }
    } catch {
      // If API fails but we have a valid expiresAt param, use it
      if (expiresAtParam) {
        const expiresAt = parseInt(expiresAtParam, 10);
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt > now) {
          setAccessStatus({ hasAccess: true, expiresAt, remainingSeconds: expiresAt - now });
          return;
        }
      }
      setAccessStatus({ hasAccess: false, reason: 'Failed to verify access' });
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const handleAccessExpired = () => {
    setAccessStatus({ hasAccess: false, reason: 'Access has expired' });
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (walletLoading || isCheckingAccess) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Verifying wallet access...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-4 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-8 max-w-sm w-full text-center border border-cyan-500/20"
          >
            <Lock className="w-16 h-16 text-cyan-400/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Wallet Required</h2>
            <p className="text-gray-400 text-sm mb-6">
              Connect your NEAR wallet to verify access and watch this content.
            </p>
            <button onClick={login} className="btn-cyber-primary px-6 py-3 rounded-xl w-full mb-3">
              Connect Wallet
            </button>
            <Link href={`/campaign/${campaignId}`} className="text-sm text-gray-500 hover:text-gray-300">
              View Campaign Details
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── No access ─────────────────────────────────────────────────────────────
  if (!accessStatus?.hasAccess) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-4 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-8 max-w-sm w-full text-center border border-red-500/20"
          >
            <Lock className="w-16 h-16 text-red-400/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 text-sm mb-2">
              {accessStatus?.reason || 'You do not have access to this content.'}
            </p>
            <p className="text-gray-600 text-xs mb-6">
              Connected as: {accountId}
            </p>
            <Link
              href={`/campaign/${campaignId}`}
              className="btn-cyber-primary px-6 py-3 rounded-xl w-full flex items-center justify-center gap-2 mb-3"
            >
              <Lock className="w-4 h-4" />
              Purchase Access
            </Link>
            <Link href="/marketplace" className="text-sm text-gray-500 hover:text-gray-300">
              Back to Marketplace
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Authorized viewer ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Back */}
        <Link
          href={`/campaign/${campaignId}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Campaign Details
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-white">{campaignTitle || 'Secure Stream'}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Shield className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-green-400">Wallet-Gated Access Active</span>
              </div>
            </div>
          </div>

          {/* Secure Player */}
          <SecurePlayer
            campaignId={campaignId}
            accountId={accountId!}
            accessExpiresAt={accessStatus.expiresAt!}
            metadataCid={metadataCid}
            onAccessExpired={handleAccessExpired}
          />
        </motion.div>
      </div>
    </div>
  );
}
