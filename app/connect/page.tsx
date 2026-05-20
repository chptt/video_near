/**
 * PrivateStream NEAR - Connect Wallet Page
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Wallet, ArrowRight, Zap, Lock, Globe } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useWallet } from '@/contexts/WalletContext';

export default function ConnectPage() {
  const { isSignedIn, isLoading, login } = useWallet();
  const router = useRouter();

  // Redirect if already connected
  useEffect(() => {
    if (!isLoading && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, isLoading, router]);

  const benefits = [
    { icon: Lock, text: 'Wallet-gated access to encrypted content' },
    { icon: Zap, text: 'Instant NEAR payments with automatic splits' },
    { icon: Globe, text: 'Decentralized identity — no email required' },
    { icon: Shield, text: 'Privacy-preserving architecture' },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="flex items-center justify-center min-h-screen px-4 pt-16">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-strong rounded-2xl p-8 border border-cyan-500/20"
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <Wallet className="w-10 h-10 text-cyan-400" />
                </div>
                <div className="absolute inset-0 blur-xl bg-cyan-400/20 rounded-2xl" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Connect NEAR Wallet
            </h1>
            <p className="text-gray-400 text-center text-sm mb-8">
              Connect your NEAR testnet wallet to create campaigns, purchase access,
              and watch encrypted content.
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              {benefits.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span className="text-gray-300 text-sm">{text}</span>
                </div>
              ))}
            </div>

            {/* Connect Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={login}
              disabled={isLoading}
              className="w-full btn-cyber-primary py-3.5 rounded-xl flex items-center justify-center gap-2 font-semibold"
            >
              <Wallet className="w-5 h-5" />
              Connect with NEAR Wallet
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            {/* Note */}
            <p className="text-center text-xs text-gray-600 mt-4">
              You'll be redirected to wallet.testnet.near.org to approve the connection.
              No private keys are stored by this app.
            </p>
          </motion.div>

          {/* Testnet notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-center"
          >
            <p className="text-yellow-400/80 text-xs">
              ⚡ Running on NEAR Testnet — Use testnet NEAR tokens only.
              Get free testnet NEAR at{' '}
              <a
                href="https://near-faucet.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-yellow-300"
              >
                near-faucet.io
              </a>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
