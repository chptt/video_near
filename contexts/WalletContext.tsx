/**
 * PrivateStream NEAR - Wallet Context
 *
 * Uses @near-wallet-selector with modal UI.
 * Supports: MyNearWallet, NEAR Wallet, Meteor Wallet (browser extension), Sender
 */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { toast } from 'sonner';
import type { WalletSelector, AccountState } from '@near-wallet-selector/core';
import type { WalletSelectorModal } from '@near-wallet-selector/modal-ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletContextType {
  accountId: string | null;
  isSignedIn: boolean;
  isLoading: boolean;
  balance: string | null;
  selector: WalletSelector | null;
  modal: WalletSelectorModal | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  accountId: null,
  isSignedIn: false,
  isLoading: true,
  balance: null,
  selector: null,
  modal: null,
  login: () => {},
  logout: async () => {},
  refreshBalance: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<string | null>(null);
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);

  useEffect(() => {
    initWalletSelector();
  }, []);

  const initWalletSelector = async () => {
    try {
      setIsLoading(true);

      const { setupWalletSelector } = await import('@near-wallet-selector/core');
      const { setupModal } = await import('@near-wallet-selector/modal-ui');
      const { setupMyNearWallet } = await import('@near-wallet-selector/my-near-wallet');
      const { setupMeteorWallet } = await import('@near-wallet-selector/meteor-wallet');
      const { setupSender } = await import('@near-wallet-selector/sender');
      const { setupHereWallet } = await import('@near-wallet-selector/here-wallet');

      // Import modal CSS - use link tag to avoid TS issues
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@near-wallet-selector/modal-ui@8.9.3/styles.css';
      document.head.appendChild(link);

      const _selector = await setupWalletSelector({
        network: 'testnet',
        modules: [
          setupMeteorWallet(),      // Browser extension
          setupSender(),            // Sender browser extension
          setupMyNearWallet({
            walletUrl: 'https://testnet.mynearwallet.com',
          }),
          setupHereWallet(),
        ],
      });

      const _modal = setupModal(_selector, {
        contractId: 'privatestream.chandanapt.testnet',
        description: 'Connect your NEAR wallet to access PrivateStream',
      });

      // Subscribe to account changes
      _selector.store.observable.subscribe((state) => {
        const accounts: AccountState[] = state.accounts;
        const activeAccount = accounts.find((a) => a.active);
        if (activeAccount) {
          setAccountId(activeAccount.accountId);
          setIsSignedIn(true);
          fetchBalance(activeAccount.accountId, _selector);
        } else {
          setAccountId(null);
          setIsSignedIn(false);
          setBalance(null);
        }
      });

      setSelector(_selector);
      setModal(_modal);

      // Store globally for use in non-React code
      (window as unknown as { __nearSelector: typeof _selector }).__nearSelector = _selector;

      // Check existing session
      const state = _selector.store.getState();
      const active = state.accounts.find((a) => a.active);
      if (active) {
        setAccountId(active.accountId);
        setIsSignedIn(true);
        fetchBalance(active.accountId, _selector);
      }
    } catch (error) {
      console.error('[Wallet] Init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBalance = async (account: string, _sel: WalletSelector) => {
    try {
      const response = await fetch('https://rpc.testnet.near.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: '1', method: 'query',
          params: { request_type: 'view_account', finality: 'final', account_id: account },
        }),
      });
      const data = await response.json();
      if (data.result?.amount) {
        const near = Number(BigInt(data.result.amount)) / 1e24;
        setBalance(near.toFixed(4));
      }
    } catch { setBalance(null); }
  };

  const login = useCallback(() => {
    if (modal) {
      modal.show();
    } else {
      toast.error('Wallet not initialized yet. Please wait.');
    }
  }, [modal]);

  const logout = useCallback(async () => {
    try {
      if (selector) {
        const wallet = await selector.wallet();
        await wallet.signOut();
      }
      setAccountId(null);
      setIsSignedIn(false);
      setBalance(null);
      toast.success('Wallet disconnected');
    } catch (error) {
      console.error('[Wallet] Logout error:', error);
    }
  }, [selector]);

  const refreshBalance = useCallback(async () => {
    if (accountId && selector) {
      await fetchBalance(accountId, selector);
    }
  }, [accountId, selector]);

  return (
    <WalletContext.Provider
      value={{
        accountId,
        isSignedIn,
        isLoading,
        balance,
        selector,
        modal,
        login,
        logout,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
