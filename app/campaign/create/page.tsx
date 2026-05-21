/**
 * PrivateStream NEAR - Create Campaign Page
 *
 * WALLET REDIRECT HANDLING:
 * MyNearWallet (and some other wallets) use a redirect-based signing flow.
 * When the user clicks "sign" in the wallet, the browser navigates away and
 * returns with ?transactionHashes=... in the URL.
 * We persist pending campaign data in localStorage before the redirect so we
 * can restore state and show the success screen on return.
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus,
  Youtube,
  DollarSign,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { useWallet } from '@/contexts/WalletContext';
import { validateCampaignInput } from '@/lib/validation';
import { validateYouTubeUrlFormat } from '@/lib/youtube';
import {
  MIN_PRICE_NEAR,
  MAX_PRICE_NEAR,
  DEFAULT_DURATION_SECONDS,
  REVENUE_CAP_USD,
  PLATFORM_FEE_PERCENTAGE,
  CREATOR_PERCENTAGE,
} from '@/lib/constants';

const DURATION_OPTIONS = [
  { label: '1 Hour', value: 3600 },
  { label: '6 Hours', value: 21600 },
  { label: '24 Hours', value: 86400 },
  { label: '3 Days', value: 259200 },
  { label: '7 Days', value: 604800 },
  { label: '30 Days', value: 2592000 },
];

const PENDING_CAMPAIGN_KEY = 'ps_pending_campaign';

interface PendingCampaign {
  campaignId: string;
  metadataCid: string;
}

type CreateStep = 'form' | 'encrypting' | 'uploading' | 'contract' | 'success';

function CreateCampaignInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountId, isSignedIn, isLoading: walletLoading, login } = useWallet();

  const [step, setStep] = useState<CreateStep>('form');
  const [hasCampaign, setHasCampaign] = useState(false);
  const [checkingCampaign, setCheckingCampaign] = useState(false);
  const [nearUsd, setNearUsd] = useState(5);

  const [form, setForm] = useState({
    title: '',
    description: '',
    videoUrl: '',
    priceNear: '1',
    durationSeconds: DEFAULT_DURATION_SECONDS,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [campaignId, setCampaignId] = useState<string>('');
  const [metadataCid, setMetadataCid] = useState<string>('');

  // ── On mount: check if returning from wallet redirect ──────────────────────
  useEffect(() => {
    const txHashes = searchParams.get('transactionHashes');
    const errorCode = searchParams.get('errorCode');

    if (errorCode) {
      // User rejected in wallet
      toast.error('Transaction cancelled by wallet');
      localStorage.removeItem(PENDING_CAMPAIGN_KEY);
      // Clean URL
      router.replace('/campaign/create');
      return;
    }

    if (txHashes) {
      // Returned from wallet redirect — restore pending campaign
      const raw = localStorage.getItem(PENDING_CAMPAIGN_KEY);
      if (raw) {
        try {
          const pending: PendingCampaign = JSON.parse(raw);
          setCampaignId(pending.campaignId);
          setMetadataCid(pending.metadataCid);
          setStep('success');
          localStorage.removeItem(PENDING_CAMPAIGN_KEY);
          toast.success('Campaign created successfully!');
        } catch {
          localStorage.removeItem(PENDING_CAMPAIGN_KEY);
        }
      } else {
        // txHash present but no pending data — still show success
        setStep('success');
      }
      // Clean URL
      router.replace('/campaign/create');
    }
  }, [searchParams]);

  // Fetch NEAR price
  useEffect(() => {
    fetch('/api/pricing')
      .then((r) => r.json())
      .then((d) => setNearUsd(d.nearUsd || 5))
      .catch(() => {});
  }, []);

  // Check if creator already has a campaign
  useEffect(() => {
    if (accountId) {
      checkExistingCampaign();
    }
  }, [accountId]);

  const checkExistingCampaign = async () => {
    if (!accountId) return;
    setCheckingCampaign(true);
    try {
      const response = await fetch(`/api/campaign/list?all=true`);
      const data = await response.json();
      const existing = data.campaigns?.find(
        (c: { creatorAccount: string }) => c.creatorAccount === accountId
      );
      setHasCampaign(!!existing);
    } catch {
      // Ignore
    } finally {
      setCheckingCampaign(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const priceUsd = parseFloat(form.priceNear) * nearUsd;
  const creatorEarnings = priceUsd * (CREATOR_PERCENTAGE / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSignedIn) {
      toast.error('Please connect your NEAR wallet first');
      await login();
      return;
    }

    const validation = validateCampaignInput(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      toast.error('Please fix the form errors');
      return;
    }

    try {
      // Step 1: Encrypt + upload to IPFS
      setStep('encrypting');
      await new Promise((r) => setTimeout(r, 800));

      setStep('uploading');

      const createResponse = await fetch('/api/campaign/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorAccount: accountId,
          ...form,
        }),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        if (createData.code === 'DUPLICATE_CAMPAIGN') {
          setHasCampaign(true);
          toast.error('You already own an active campaign');
          setStep('form');
          return;
        }
        throw new Error(createData.error || 'Failed to create campaign');
      }

      setCampaignId(createData.campaignId);
      setMetadataCid(createData.metadataCid);

      // ── Persist before wallet redirect ──────────────────────────────────────
      // MyNearWallet redirects the browser to sign. We save the campaign data
      // so we can restore it when the user returns.
      const pending: PendingCampaign = {
        campaignId: createData.campaignId,
        metadataCid: createData.metadataCid,
      };
      localStorage.setItem(PENDING_CAMPAIGN_KEY, JSON.stringify(pending));

      // Step 2: Call smart contract
      setStep('contract');

      const { callChangeMethod, nearToYocto } = await import('@/lib/near');

      const result = await callChangeMethod(
        'create_campaign',
        {
          campaignId: createData.campaignId,
          metadataCid: createData.metadataCid,
          priceYocto: nearToYocto(form.priceNear),
          durationSeconds: form.durationSeconds,
        },
        '0',
        '30000000000000'
      );

      // If we reach here the wallet used a popup/async flow (Meteor, Sender)
      // and didn't redirect — show success directly.
      localStorage.removeItem(PENDING_CAMPAIGN_KEY);
      setStep('success');
      toast.success('Campaign created successfully!');
      console.log('[Create] Contract result:', result);
    } catch (error) {
      console.error('[Create] Error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create campaign';

      if (message.includes('User rejected') || message.includes('user rejected')) {
        localStorage.removeItem(PENDING_CAMPAIGN_KEY);
        toast.error('Transaction cancelled');
      } else if (message.includes('redirect') || message.includes('navigation')) {
        // Wallet is redirecting — don't show error, pending data is saved
        return;
      } else {
        localStorage.removeItem(PENDING_CAMPAIGN_KEY);
        toast.error(message);
      }

      setStep('form');
    }
  };

  // ── Render: Not connected ─────────────────────────────────────────────────
  if (!walletLoading && !isSignedIn) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-4 pt-16">
          <div className="text-center max-w-sm">
            <Shield className="w-16 h-16 text-cyan-400/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Wallet Required</h2>
            <p className="text-gray-400 text-sm mb-6">
              Connect your NEAR wallet to create a campaign.
            </p>
            <button onClick={login} className="btn-cyber-primary px-6 py-3 rounded-xl">
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Already has campaign ──────────────────────────────────────────
  if (hasCampaign && step === 'form') {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-4 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-8 max-w-md w-full text-center border border-yellow-500/20"
          >
            <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Campaign Limit Reached</h2>
            <p className="text-gray-400 text-sm mb-6">
              You already own an active campaign. Each NEAR account can only create one campaign.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-cyber-primary px-6 py-3 rounded-xl w-full"
            >
              View My Campaign
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Render: Success ───────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-4 pt-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong rounded-2xl p-8 max-w-md w-full text-center border border-green-500/20"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Campaign Live!</h2>
            <p className="text-gray-400 text-sm mb-2">
              Your video metadata has been encrypted and uploaded to IPFS.
            </p>
            {metadataCid && (
              <p className="text-xs text-gray-600 font-mono mb-6 break-all">
                CID: {metadataCid}
              </p>
            )}
            <div className="space-y-3">
              {campaignId && (
                <button
                  onClick={() => router.push(`/campaign/${campaignId}`)}
                  className="btn-cyber-primary px-6 py-3 rounded-xl w-full"
                >
                  View Campaign
                </button>
              )}
              <button
                onClick={() => router.push('/marketplace')}
                className="btn-cyber px-6 py-3 rounded-xl w-full"
              >
                Go to Marketplace
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Render: Processing ────────────────────────────────────────────────────
  if (step !== 'form') {
    const stepMessages = {
      encrypting: { text: 'Encrypting video metadata...', sub: 'AES-256-GCM encryption' },
      uploading: { text: 'Uploading to IPFS...', sub: 'Pinata decentralized storage' },
      contract: { text: 'Calling smart contract...', sub: 'Confirm in your NEAR wallet' },
    };
    const msg = stepMessages[step as keyof typeof stepMessages];

    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-4 pt-16">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-1">{msg?.text}</h3>
            <p className="text-gray-500 text-sm">{msg?.sub}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Plus className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Create Campaign</h1>
              <p className="text-gray-400 text-sm">
                One campaign per NEAR account. Metadata encrypted before storage.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Campaign Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="My Exclusive Tutorial Series"
                className={`input-cyber ${errors.title ? 'border-red-500/50' : ''}`}
                maxLength={100}
              />
              {errors.title && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.title}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe what buyers will get access to..."
                rows={4}
                className={`input-cyber resize-none ${errors.description ? 'border-red-500/50' : ''}`}
                maxLength={1000}
              />
              <div className="flex justify-between mt-1">
                {errors.description ? (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.description}
                  </p>
                ) : <span />}
                <span className="text-gray-600 text-xs">{form.description.length}/1000</span>
              </div>
            </div>

            {/* YouTube URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-400" />
                  Unlisted YouTube URL *
                </div>
              </label>
              <input
                type="url"
                value={form.videoUrl}
                onChange={(e) => handleChange('videoUrl', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className={`input-cyber ${errors.videoUrl ? 'border-red-500/50' : ''}`}
              />
              {errors.videoUrl ? (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.videoUrl}
                </p>
              ) : form.videoUrl && validateYouTubeUrlFormat(form.videoUrl).valid ? (
                <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Valid YouTube URL
                </p>
              ) : null}
              <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">
                  This URL will be AES-256-GCM encrypted before storage. Only verified buyers can decrypt it.
                  Make sure your video is set to "Unlisted" on YouTube.
                </p>
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Price (NEAR) *
                </div>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.priceNear}
                  onChange={(e) => handleChange('priceNear', e.target.value)}
                  min={MIN_PRICE_NEAR}
                  max={MAX_PRICE_NEAR}
                  step="0.1"
                  className={`input-cyber pr-24 ${errors.priceNear ? 'border-red-500/50' : ''}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  NEAR
                </span>
              </div>
              {errors.priceNear ? (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.priceNear}
                </p>
              ) : (
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>≈ ${priceUsd.toFixed(2)} USD</span>
                  <span className="text-green-400">You receive: ${creatorEarnings.toFixed(2)} ({CREATOR_PERCENTAGE}%)</span>
                  <span className="text-gray-600">Platform: {PLATFORM_FEE_PERCENTAGE}%</span>
                </div>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  Access Duration *
                </div>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange('durationSeconds', opt.value)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      form.durationSeconds === opt.value
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
                        : 'glass border border-white/5 text-gray-400 hover:border-cyan-500/20 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Revenue cap info */}
            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-400 space-y-1">
                  <p className="font-medium text-yellow-400">Revenue Cap: ${REVENUE_CAP_USD} USD</p>
                  <p>Your campaign will automatically close when it reaches ${REVENUE_CAP_USD} gross revenue. Existing buyers retain access until their access expires.</p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full btn-cyber-primary py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Encrypt & Create Campaign
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default function CreateCampaignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    }>
      <CreateCampaignInner />
    </Suspense>
  );
}
