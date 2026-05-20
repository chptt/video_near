/**
 * PrivateStream NEAR - Root Layout
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { WalletProvider } from '@/contexts/WalletContext';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    'NEAR Protocol',
    'Web3',
    'decentralized',
    'video monetization',
    'encrypted',
    'IPFS',
    'blockchain',
    'FHE',
    'privacy',
  ],
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} cyber-bg`}>
        {/* Subtle scan line overlay for cyberpunk aesthetic */}
        <div className="scan-overlay" aria-hidden="true" />

        <WalletProvider>
          {children}
        </WalletProvider>

        {/* Toast notifications */}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(5, 5, 8, 0.95)',
              border: '1px solid rgba(0, 245, 255, 0.2)',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  );
}
