# PrivateStream NEAR

**Encrypted. Decentralized. Wallet-Gated.**

A production-ready decentralized Web3 application on NEAR Protocol for monetizing unlisted YouTube videos with encrypted metadata, wallet-gated access control, and automatic revenue splitting.

> **Architecture Note:** This MVP demonstrates FHE-inspired encrypted access control architecture using encrypted metadata and wallet-gated decryption. While actual Fully Homomorphic Encryption computation is not implemented, the architecture is designed for future migration to NEAR confidential computing, encrypted execution layers, privacy-preserving smart contracts, and MPC/FHE systems.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [NEAR Wallet Integration](#3-near-wallet-integration)
4. [Pinata IPFS Setup](#4-pinata-ipfs-setup)
5. [Environment Variables](#5-environment-variables)
6. [Smart Contract Deployment](#6-smart-contract-deployment)
7. [Revenue Cap System](#7-revenue-cap-system)
8. [Commission System](#8-commission-system)
9. [Privacy Architecture](#9-privacy-architecture)
10. [FHE-Inspired Design](#10-fhe-inspired-design)
11. [Security Model](#11-security-model)
12. [Demo Flow](#12-demo-flow)
13. [Known Limitations](#13-known-limitations)
14. [Future Roadmap](#14-future-roadmap)

---

## 1. Project Overview

PrivateStream NEAR allows content creators to:

- Connect a NEAR wallet and create **one campaign per account**
- Upload an **unlisted YouTube video link** (encrypted before storage)
- Set a **price in NEAR**, **access duration**, and campaign details
- Receive **90% of every payment** automatically via smart contract
- Have their campaign **auto-close at $20 USD gross revenue**

Buyers can:

- Browse the marketplace of active campaigns
- Pay NEAR tokens to unlock **temporary access**
- Watch the embedded video only inside the platform
- Retain access until their purchased duration expires

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion |
| Blockchain | NEAR Protocol, near-api-js |
| Storage | Pinata IPFS |
| Encryption | AES-256-GCM (Node.js crypto) |
| Backend | Next.js Serverless API Routes |
| Deployment | Vercel |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CREATOR FLOW                              │
│                                                                   │
│  Creator → Connect NEAR Wallet                                   │
│         → Submit Campaign Form (title, desc, YouTube URL, price) │
│         → [SERVER] Encrypt YouTube URL (AES-256-GCM)            │
│         → [SERVER] Upload encrypted metadata to Pinata IPFS     │
│         → [NEAR CONTRACT] create_campaign(campaignId, CID, ...)  │
│         → Campaign appears in Marketplace                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         BUYER FLOW                               │
│                                                                   │
│  Buyer → Connect NEAR Wallet                                     │
│        → Browse Marketplace (encrypted metadata, public fields)  │
│        → Click "Pay to Unlock"                                   │
│        → [NEAR CONTRACT] purchase_access(campaignId) + deposit   │
│        → Contract: splits payment (90% creator, 10% platform)   │
│        → Contract: records access expiry on-chain               │
│        → [SERVER] Verify transaction hash                        │
│        → [SERVER] Check access expiry from contract             │
│        → [SERVER] Fetch encrypted metadata from IPFS            │
│        → [SERVER] Decrypt YouTube URL (AES-256-GCM)             │
│        → [SERVER] Convert to embed URL                          │
│        → [CLIENT] Render iframe player                          │
│        → Access expires automatically                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ENCRYPTION LAYER                              │
│                                                                   │
│  Raw YouTube URL                                                 │
│       ↓ AES-256-GCM encrypt (server-side, random IV)            │
│  { ciphertext, iv, authTag }                                     │
│       ↓ Upload to IPFS                                          │
│  IPFS CID (stored on-chain)                                     │
│       ↓ On authorized request only                              │
│  AES-256-GCM decrypt (server-side, after wallet verification)   │
│       ↓ Convert to embed URL                                    │
│  YouTube Embed URL (returned to client, never raw URL)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. NEAR Wallet Integration

### Setup

The app uses `near-api-js` for wallet integration on NEAR testnet.

```typescript
// lib/near.ts
import { connect, WalletConnection, keyStores } from 'near-api-js';

const config = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://wallet.testnet.near.org',
  helperUrl: 'https://helper.testnet.near.org',
};
```

### Login Flow

1. User clicks "Connect Wallet"
2. App calls `wallet.requestSignIn({ contractId: CONTRACT_NAME })`
3. User is redirected to `wallet.testnet.near.org`
4. User approves the connection
5. NEAR Wallet redirects back with `account_id` and `all_keys` in URL params
6. `near-api-js` stores the key in `localStorage`
7. App reads `wallet.getAccountId()` to get the connected account

### Get Testnet NEAR

Free testnet NEAR tokens: https://near-faucet.io

---

## 4. Pinata IPFS Setup

1. Create account at https://app.pinata.cloud
2. Go to **API Keys** → **New Key**
3. Enable: `pinFileToIPFS`, `pinJSONToIPFS`, `unpin`
4. Copy the **JWT** token
5. Set `PINATA_JWT=your_jwt_here` in `.env.local`

### What Gets Stored on IPFS

```json
{
  "campaignId": "uuid-v4",
  "title": "Campaign Title",
  "description": "Public description",
  "encryptedVideoUrl": "base64-ciphertext",
  "iv": "base64-iv",
  "authTag": "base64-auth-tag",
  "creatorAccount": "creator.testnet",
  "priceNear": "1",
  "durationSeconds": 86400,
  "revenueCapUsd": 20,
  "platformFeePercentage": 10,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "status": "active"
}
```

The `encryptedVideoUrl`, `iv`, and `authTag` are the AES-256-GCM encrypted YouTube URL. The raw URL is **never stored**.

---

## 5. Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | Your app URL | Yes |
| `NEXT_PUBLIC_NEAR_NETWORK` | `testnet` or `mainnet` | Yes |
| `NEXT_PUBLIC_NEAR_NODE_URL` | NEAR RPC endpoint | Yes |
| `NEXT_PUBLIC_NEAR_WALLET_URL` | NEAR Wallet URL | Yes |
| `NEXT_PUBLIC_NEAR_HELPER_URL` | NEAR Helper URL | Yes |
| `NEXT_PUBLIC_CONTRACT_NAME` | Your deployed contract account ID | Yes |
| `PINATA_JWT` | Pinata API JWT token | Yes |
| `PINATA_GATEWAY_URL` | Pinata gateway URL | Yes |
| `ENCRYPTION_MASTER_KEY` | 32-byte hex key for AES-256-GCM | Yes |
| `PLATFORM_TREASURY_ACCOUNT` | NEAR account for platform fees | Yes |
| `REVENUE_CAP_USD` | Revenue cap per campaign (default: 20) | No |
| `PLATFORM_FEE_PERCENTAGE` | Platform fee % (default: 10) | No |
| `NEAR_USD_FALLBACK` | Fallback NEAR/USD price (default: 5) | No |

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Smart Contract Deployment

The smart contract is in `contracts/private_stream_near.js` (NEAR JS SDK).

### Prerequisites

```bash
npm install -g near-cli
npm install -g near-sdk-js
```

### Build

```bash
npx near-sdk-js build contracts/private_stream_near.js --out contract.wasm
```

### Deploy

```bash
# Create a new account for the contract
near create-account privatestream.testnet --masterAccount your-account.testnet

# Deploy
near deploy --accountId privatestream.testnet --wasmFile contract.wasm

# Initialize
near call privatestream.testnet init \
  '{"treasuryAccount": "treasury.testnet", "nearPriceCents": 500}' \
  --accountId privatestream.testnet
```

### Contract Methods

**View Methods (free):**
- `get_campaign({ campaignId })` — Get campaign by ID
- `get_active_campaigns()` — List active campaigns
- `get_creator_campaign({ accountId })` — Get creator's campaign
- `has_campaign({ accountId })` — Check if account has campaign
- `get_access_expiry({ accountId, campaignId })` — Get access expiry timestamp
- `has_valid_access({ accountId, campaignId })` — Check if access is valid

**Change Methods (require gas):**
- `create_campaign({ campaignId, metadataCid, priceYocto, durationSeconds })` — Create campaign
- `purchase_access({ campaignId })` — Purchase access (payable)
- `update_near_price({ priceCents })` — Update NEAR/USD price

---

## 7. Revenue Cap System

Each campaign has a **$20 USD gross revenue cap**.

### How It Works

1. Every purchase adds to `grossRevenueYocto` on the contract
2. The contract converts NEAR to USD using `nearPriceCents`
3. When `grossRevenueUsd >= $20`, the campaign is marked `soldOut = true`
4. New purchases are **blocked** by the contract
5. The campaign is **hidden from the marketplace**
6. **Existing buyers retain access** until their purchased duration expires

### Revenue Calculation

```
grossRevenueUsd = (grossRevenueYocto * nearPriceCents) / (10^24 * 100)
```

### Cap Enforcement

- **Smart contract level**: `purchase_access()` reverts if `soldOut == true`
- **Backend level**: API returns 409 if campaign is sold out
- **Frontend level**: Purchase button is disabled for sold-out campaigns

---

## 8. Commission System

Every payment is automatically split by the smart contract:

```
Total Payment: X NEAR
├── Creator (90%): X * 0.90 NEAR → transferred to creator account
└── Platform (10%): X * 0.10 NEAR → transferred to treasury account
```

### Example

| Payment | Creator (90%) | Platform (10%) |
|---------|--------------|----------------|
| 1 NEAR | 0.9 NEAR | 0.1 NEAR |
| 5 NEAR | 4.5 NEAR | 0.5 NEAR |
| 10 NEAR | 9 NEAR | 1 NEAR |

The split is enforced **on-chain** — the creator and platform receive funds directly in the same transaction. There is no escrow or manual withdrawal required.

---

## 9. Privacy Architecture

### What Is Protected

| Data | Protection |
|------|-----------|
| YouTube URL | AES-256-GCM encrypted, never stored in plaintext |
| Encryption Key | Server-side only, never exposed to client |
| Access Control | Enforced by NEAR smart contract |
| Play Sessions | Short-lived HMAC-signed tokens (5 min TTL) |

### What Is Public

| Data | Visibility |
|------|-----------|
| Campaign title | Public |
| Campaign description | Public |
| Creator account | Public |
| Price | Public |
| Revenue stats | Public |
| IPFS CID | Public (points to encrypted data) |
| Encrypted ciphertext | Public (useless without key) |

### Decryption Flow

```
1. Buyer requests /api/campaign/{id}/play
2. Server checks access record (contract or registry)
3. Server verifies access has not expired
4. Server fetches encrypted metadata from IPFS
5. Server decrypts with ENCRYPTION_MASTER_KEY (AES-256-GCM)
6. Server converts raw URL to embed URL
7. Server issues HMAC-signed play token (5 min TTL)
8. Client receives embed URL only (not raw URL)
9. Client renders iframe with embed URL
```

---

## 10. FHE-Inspired Design

> **This MVP demonstrates FHE-inspired encrypted access control architecture using encrypted metadata and wallet-gated decryption.**

### Current Implementation (Simulated Privacy)

The current architecture approximates FHE principles:

- **Encrypted at rest**: Video metadata encrypted before leaving the server
- **Encrypted in transit**: HTTPS + encrypted IPFS storage
- **Wallet-gated decryption**: Only the server decrypts, only after wallet verification
- **Access control on-chain**: Smart contract enforces who can request decryption
- **No plaintext exposure**: Raw URLs never reach the client

### Future Migration Path

| Current | Future (FHE/MPC) |
|---------|-----------------|
| AES-256-GCM server-side | Homomorphic encryption in enclave |
| Server-side decryption | Decryption inside TEE/confidential VM |
| HMAC play tokens | Zero-knowledge access proofs |
| NEAR contract access control | MPC threshold decryption |
| Centralized key management | Distributed key shares (MPC) |

### Suitable For Migration To

- **NEAR Confidential Computing** — When NEAR adds TEE/enclave support
- **Encrypted Execution Layers** — Compute on encrypted data without decryption
- **Privacy-Preserving Smart Contracts** — Contract logic hidden from validators
- **MPC/FHE Systems** — Threshold decryption requiring multiple parties

---

## 11. Security Model

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Raw URL exposure | AES-256-GCM encryption, server-side only decryption |
| Unauthorized access | NEAR wallet verification + contract access check |
| Replay attacks | Transaction hash deduplication |
| Token reuse | HMAC-signed tokens with 5-minute TTL |
| Key exposure | `ENCRYPTION_MASTER_KEY` is server-side env var only |
| Duplicate campaigns | Contract enforces one-per-account |
| Revenue manipulation | On-chain revenue tracking |
| Payment fraud | Transaction verified on NEAR RPC before access granted |

### What This Does NOT Protect Against

- Advanced users inspecting network requests to find the embed URL
- YouTube's own security (unlisted videos can be shared if URL is known)
- Server compromise (if server is compromised, key is exposed)
- NEAR RPC manipulation (use multiple RPC endpoints in production)

---

## 12. Demo Flow

### Creator Demo

```
1. Open http://localhost:3000
2. Click "Connect Wallet" → approve on NEAR testnet wallet
3. Navigate to /campaign/create
4. Fill in:
   - Title: "My Exclusive Tutorial"
   - Description: "Advanced Web3 development techniques"
   - YouTube URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ (unlisted)
   - Price: 1 NEAR
   - Duration: 24 Hours
5. Click "Encrypt & Create Campaign"
6. Approve the NEAR transaction in wallet
7. Campaign appears in /marketplace
```

### Buyer Demo

```
1. Connect a different NEAR wallet
2. Navigate to /marketplace
3. Find the campaign → click it
4. Click "Pay 1 NEAR to Unlock"
5. Approve the NEAR transaction
6. Click "Watch Now"
7. Video plays in secure iframe
8. Countdown timer shows remaining access time
```

### Revenue Cap Demo

```
1. Multiple buyers purchase access
2. Dashboard shows revenue progress bar filling
3. When $20 USD is reached:
   - Campaign disappears from marketplace
   - "Sold Out" badge appears
   - New purchases blocked
   - Existing buyers still watch until expiry
```

---

## 13. Known Limitations

### YouTube Embedding

> YouTube iframe embedding cannot fully prevent advanced users from inspecting network requests to find the embed URL. The embed URL format (`youtube.com/embed/VIDEO_ID`) is visible in the iframe `src` attribute via browser DevTools.

**Mitigation in this MVP:**
- We return the embed URL (not the raw watch URL)
- Embed URLs cannot be used to download the video
- The raw `youtube.com/watch?v=` URL is never exposed

**Production solution:** Use encrypted HLS streaming with DRM.

### Serverless State

The campaign registry uses in-memory storage that resets on Vercel cold starts. In production, replace with:
- Vercel KV (Redis)
- PlanetScale (MySQL)
- Direct NEAR contract queries

### NEAR Price Oracle

The NEAR/USD price uses CoinGecko API with a fallback. For production, use:
- Pyth Network oracle
- Band Protocol
- Chainlink (when available on NEAR)

### One Campaign Per Account

The one-campaign-per-account rule is enforced at:
1. Frontend (UI check)
2. Backend API (registry check)
3. Smart contract (`creatorCampaigns` mapping)

---

## 14. Future Roadmap

### Phase 2: Enhanced Privacy
- [ ] Encrypted HLS streaming (replace YouTube embeds)
- [ ] Digital Rights Management (DRM) integration
- [ ] Zero-knowledge access proofs
- [ ] Decentralized key management (Shamir's Secret Sharing)

### Phase 3: Confidential Computing
- [ ] NEAR TEE/enclave integration (when available)
- [ ] MPC threshold decryption
- [ ] Homomorphic encryption for access control
- [ ] Private smart contract execution

### Phase 4: Platform Features
- [ ] Multiple campaigns per creator (with staking requirement)
- [ ] Subscription model (recurring NEAR payments)
- [ ] Creator analytics dashboard
- [ ] NFT-gated access
- [ ] DAO governance for platform fees

### Phase 5: Decentralization
- [ ] Fully on-chain access control
- [ ] Decentralized storage (Arweave/Filecoin)
- [ ] Cross-chain access (NEAR + Ethereum)
- [ ] Decentralized CDN for video delivery

---

## Local Development

```bash
# Clone and install
git clone <repo>
npm install --legacy-peer-deps

# Configure environment
cp .env.example .env.local
# Fill in all required values

# Run development server
npm run dev

# Open http://localhost:3000
```

## Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# or use: vercel env add VARIABLE_NAME
```

---

## License

MIT License — See LICENSE file for details.

---

*Built with ❤️ on NEAR Protocol. Encrypted with AES-256-GCM. Stored on IPFS.*
