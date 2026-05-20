/**
 * PrivateStream NEAR - Wallet Connect Button
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, Copy, ChevronDown, CheckCircle } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';

export function WalletConnect() {
  const { accountId, isSignedIn, isLoading, balance, login, logout } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!accountId) return;
    await navigator.clipboard.writeText(accountId);
    setCopied(true);
    toast.success('Account ID copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAccount = (id: string) => {
    if (id.length <= 20) return id;
    return `${id.slice(0, 8)}...${id.slice(-6)}`;
  };

  if (isLoading) {
    return (
      <div className="h-9 w-32 skeleton rounded-lg" />
    );
  }

  if (!isSignedIn) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={login}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm btn-cyber-primary"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </motion.button>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.01 }}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg glass border border-cyan-500/20 hover:border-cyan-500/40 transition-all text-sm"
      >
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-white font-medium hidden sm:block">
          {truncateAccount(accountId!)}
        </span>
        <span className="text-white font-medium sm:hidden">
          {accountId!.slice(0, 6)}...
        </span>
        {balance && (
          <span className="text-cyan-400 text-xs hidden md:block">
            {balance} Ⓝ
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {dropdownOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-64 glass-strong rounded-xl border border-cyan-500/20 shadow-2xl z-50 overflow-hidden"
            >
              {/* Account info */}
              <div className="p-4 border-b border-cyan-500/10">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-green-400 font-medium">Connected</span>
                </div>
                <p className="text-white font-medium text-sm break-all">{accountId}</p>
                {balance && (
                  <p className="text-cyan-400 text-sm mt-1">{balance} NEAR</p>
                )}
              </div>

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? 'Copied!' : 'Copy Account ID'}
                </button>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
