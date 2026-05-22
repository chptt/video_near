/**
 * PrivateStream NEAR - Navigation Bar
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Zap, Shield, LayoutDashboard, Store, Plus, ShoppingBag } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { WalletConnect } from './WalletConnect';
import { APP_NAME } from '@/lib/constants';

const navLinks = [
  { href: '/marketplace', label: 'Marketplace', icon: Store },
  { href: '/purchases', label: 'My Purchases', icon: ShoppingBag },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaign/create', label: 'Create', icon: Plus },
];

export function Navbar() {
  const pathname = usePathname();
  const { isSignedIn } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-cyan-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Shield className="w-7 h-7 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
              <div className="absolute inset-0 blur-sm bg-cyan-400/30 rounded-full group-hover:bg-cyan-400/50 transition-all" />
            </div>
            <span className="font-bold text-lg gradient-text hidden sm:block">
              {APP_NAME}
            </span>
            <span className="font-bold text-lg gradient-text sm:hidden">PSN</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* NEAR testnet badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <Zap className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-yellow-400 font-medium">Testnet</span>
            </div>

            <WalletConnect />

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-cyan-500/10 glass"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
