/**
 * PrivateStream NEAR - Marketplace Page
 * Shows all active campaigns available for purchase.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Store, Search, RefreshCw, Zap } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CampaignCard, CampaignCardData } from '@/components/CampaignCard';
import { CampaignCardSkeleton } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';

export default function MarketplacePage() {
  const [campaigns, setCampaigns] = useState<CampaignCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/campaign/list?limit=50');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      setError('Failed to load campaigns. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const filtered = campaigns.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.creatorAccount.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Marketplace</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Discover encrypted video campaigns. Pay NEAR to unlock temporary access.
          </p>
        </motion.div>

        {/* Search + Refresh */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-3 mb-8"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-cyber pl-10 text-sm"
            />
          </div>
          <button
            onClick={fetchCampaigns}
            disabled={isLoading}
            className="btn-cyber px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </motion.div>

        {/* Stats bar */}
        {!isLoading && campaigns.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 mb-6"
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-gray-400">
              {filtered.length} active campaign{filtered.length !== 1 ? 's' : ''} available
            </span>
          </motion.div>
        )}

        {/* Content */}
        {error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={fetchCampaigns} className="btn-cyber px-6 py-2 rounded-lg text-sm">
              Try Again
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Store}
            title={searchQuery ? 'No campaigns found' : 'No active campaigns'}
            description={
              searchQuery
                ? `No campaigns match "${searchQuery}". Try a different search.`
                : 'Be the first to create a campaign and start monetizing your content.'
            }
            actionLabel={searchQuery ? undefined : 'Create Campaign'}
            actionHref={searchQuery ? undefined : '/campaign/create'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((campaign, i) => (
              <CampaignCard key={campaign.id} campaign={campaign} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
