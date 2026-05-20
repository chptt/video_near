/**
 * PrivateStream NEAR - Wallet Context
 *
 * Provides NEAR wallet state and actions throughout the app.
 * Handles wallet initialization, login, logout, and account state.
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletContextType {
  accountId: string | null;
  isSignedIn: boolean;
  isLoading: boolean;
  balance: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextType>({
  accountId: null,
  isSignedIn: false,
  isLoading: true,
  balance: null,
  login: async () => {},
  logout: async () => {},
  refreshBalance: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<string | null>(null);

  // Initialize wallet state on mount
  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      setIsLoading(true);

      // Dynamically import near-api-js (client-side only)
      const { getWalletState } = await import('@/lib/near');
      const state = await getWalletState();

      setAccountId(state.accountId);
      setIsSignedIn(state.isSignedIn);

      if (state.accountId) {
        await fetchBalance(state.accountId);
      }
    } catch (error) {
      console.error('[Wallet] Initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBalance = async (account: string) => {
    try {
      const { getAccountBalance, yoctoToNear } = await import('@/lib/near');
      const yoctoBalance = await getAccountBalance(account);
      const nearBalance = yoctoToNear(yoctoBalance);
      const formatted = parseFloat(nearBalance).toFixed(4);
      setBalance(formatted);
    } catch {
      setBalance(null);
    }
  };

  const login = useCallback(async () => {
    try {
      const { loginWithNearWallet } = await import('@/lib/near');
      await loginWithNearWallet();
    } catch (error) {
      console.error('[Wallet] Login error:', error);
      toast.error('Failed to connect wallet. Please try again.');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const { logoutNearWallet } = await import('@/lib/near');
      await logoutNearWallet();
      setAccountId(null);
      setIsSignedIn(false);
      setBalance(null);
      toast.success('Wallet disconnected');
    } catch (error) {
      console.error('[Wallet] Logout error:', error);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (accountId) {
      await fetchBalance(accountId);
    }
  }, [accountId]);

  return (
    <WalletContext.Provider
      value={{
        accountId,
        isSignedIn,
        isLoading,
        balance,
        login,
        logout,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
