/**
 * PrivateStream NEAR - Landing Page
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  Lock,
  Zap,
  Globe,
  ArrowRight,
  Play,
  DollarSign,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { APP_NAME, APP_TAGLINE, REVENUE_CAP_USD, PLATFORM_FEE_PERCENTAGE } from '@/lib/constants';

const features = [
  {
    icon: Lock,
    title: 'AES-256-GCM Encryption',
    description:
      'Video metadata encrypted before storage. Raw URLs never leave the server unencrypted.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  {
    icon: Shield,
    title: 'Wallet-Gated Access',
    description:
      'Only verified NEAR wallet holders with valid purchases can decrypt and watch content.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: Globe,
    title: 'Decentralized Storage',
    description:
      'Encrypted metadata stored on IPFS via Pinata. No central server holds your content.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
  },
  {
    icon: DollarSign,
    title: 'Automatic Revenue Split',
    description:
      `Creators receive 90% of every payment. Platform takes ${PLATFORM_FEE_PERCENTAGE}%. Enforced by smart contract.`,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  {
    icon: Clock,
    title: 'Temporary Access',
    description:
      'Time-limited access windows. Buyers get exactly what they paid for — no more, no less.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  {
    icon: Zap,
    title: 'Revenue Cap System',
    description:
      `Campaigns auto-close at $${REVENUE_CAP_USD} gross revenue. Existing buyers retain access until expiry.`,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
];

const steps = [
  { step: '01', title: 'Connect Wallet', desc: 'Link your NEAR testnet wallet' },
  { step: '02', title: 'Create Campaign', desc: 'Upload unlisted YouTube link + set price' },
  { step: '03', title: 'Metadata Encrypted', desc: 'AES-256-GCM encryption before IPFS upload' },
  { step: '04', title: 'Buyers Pay NEAR', desc: 'Smart contract splits payment automatically' },
  { step: '05', title: 'Access Granted', desc: 'Wallet-gated decryption for verified buyers' },
  { step: '06', title: 'Revenue Cap Hit', desc: 'Campaign closes at $20 — existing access preserved' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #00f5ff, #bf00ff, transparent)' }}
        />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-cyan-500/20 mb-8">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">
                FHE-Inspired Privacy Architecture on NEAR Protocol
              </span>
            </div>

            {/* Title */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="gradient-text">{APP_NAME}</span>
            </h1>

            <p className="text-xl text-gray-400 mb-4 font-light">
              {APP_TAGLINE}
            </p>

            <p className="text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              Monetize unlisted YouTube videos with NEAR payments. Encrypted metadata on IPFS.
              Wallet-gated decryption. Automatic revenue splitting. One campaign per creator.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/marketplace">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-cyber-primary px-8 py-3.5 rounded-xl flex items-center gap-2 text-base font-semibold"
                >
                  <Play className="w-5 h-5" />
                  Browse Marketplace
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </Link>

              <Link href="/campaign/create">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-cyber px-8 py-3.5 rounded-xl flex items-center gap-2 text-base"
                >
                  <Zap className="w-5 h-5" />
                  Create Campaign
                </motion.button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-16"
          >
            {[
              { value: '90%', label: 'Creator Revenue' },
              { value: '$20', label: 'Revenue Cap' },
              { value: 'AES-256', label: 'Encryption' },
            ].map(({ value, label }) => (
              <div key={label} className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold gradient-text">{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Privacy-First Architecture
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Built with FHE-inspired design principles. Suitable for future migration to
              NEAR confidential computing and MPC/FHE execution layers.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`glass rounded-xl p-6 border ${feature.border} hover:scale-[1.02] transition-transform`}
              >
                <div className={`w-10 h-10 rounded-lg ${feature.bg} border ${feature.border} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-gray-400">End-to-end encrypted video monetization flow</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-xl p-5 flex items-start gap-4"
              >
                <div className="text-2xl font-bold font-mono gradient-text flex-shrink-0">
                  {step.step}
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">{step.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Architecture Note */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-8 border border-purple-500/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">FHE-Inspired Architecture</h3>
            </div>
            <p className="text-gray-400 leading-relaxed mb-4">
              This MVP demonstrates FHE-inspired encrypted access control architecture using
              encrypted metadata and wallet-gated decryption. While actual Fully Homomorphic
              Encryption computation is not implemented, the architecture is designed for
              future migration to:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                'NEAR Confidential Computing',
                'Encrypted Execution Layers',
                'Privacy-Preserving Smart Contracts',
                'MPC/FHE Systems',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-300">
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cyan-500/10 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold gradient-text">{APP_NAME}</span>
            <span className="text-gray-600 text-sm">— NEAR Testnet</span>
          </div>
          <p className="text-gray-600 text-sm">
            Built on NEAR Protocol • Encrypted with AES-256-GCM • Stored on IPFS
          </p>
        </div>
      </footer>
    </div>
  );
}
