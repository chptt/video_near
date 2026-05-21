/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['gateway.pinata.cloud', 'ipfs.io'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
  // Allow CSS imports from node_modules (wallet selector modal)
  transpilePackages: [
    '@near-wallet-selector/core',
    '@near-wallet-selector/modal-ui',
    '@near-wallet-selector/my-near-wallet',
    '@near-wallet-selector/meteor-wallet',
    '@near-wallet-selector/sender',
    '@near-wallet-selector/here-wallet',
  ],
};

module.exports = nextConfig;
