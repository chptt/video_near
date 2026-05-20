# PrivateStream NEAR — Contract Deployment Guide

## Architecture Overview: What Storage We Use

```
┌──────────────────────────────────────────────────────────────────────┐
│                    STORAGE ARCHITECTURE                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Layer 1: NEAR Blockchain (on-chain state)                           │
│  ─────────────────────────────────────────                           │
│  • Campaign ID (string)                                               │
│  • Creator account ID (string)                                        │
│  • IPFS CID — pointer to encrypted metadata (string)                 │
│  • Price in yoctoNEAR (u128)                                         │
│  • Access duration in seconds (u64)                                  │
│  • Gross revenue in yoctoNEAR (u128)                                 │
│  • Purchase count (u32)                                               │
│  • active / soldOut flags (bool)                                     │
│  • Access expiry per buyer: accountId:campaignId → timestamp         │
│  • One-campaign-per-account: accountId → campaignId                  │
│                                                                       │
│  Layer 2: Pinata IPFS (off-chain, decentralized, content-addressed)  │
│  ─────────────────────────────────────────────────────────────────   │
│  • Campaign title (plaintext)                                         │
│  • Campaign description (plaintext)                                   │
│  • AES-256-GCM encrypted YouTube URL (ciphertext)                    │
│  • Encryption IV (base64)                                             │
│  • GCM Auth Tag (base64)                                              │
│  • Creator account, price, duration metadata                         │
│                                                                       │
│  WHY SPLIT?                                                           │
│  NEAR charges ~1 NEAR per 100KB of on-chain storage.                 │
│  Storing large text on-chain is expensive.                            │
│  We store only the short IPFS CID (59 chars) on-chain.               │
│  Full metadata lives on IPFS — free, permanent, decentralized.       │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## How NEAR Transactions Work

```
┌──────────────────────────────────────────────────────────────────────┐
│                    NEAR TRANSACTION FLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. USER ACTION (browser)                                             │
│     └─ Clicks "Create Campaign" or "Purchase Access"                 │
│                                                                       │
│  2. near-api-js BUILDS TRANSACTION                                   │
│     └─ FunctionCall action:                                          │
│        {                                                              │
│          contractId:      "privatestream.testnet",                   │
│          methodName:      "create_campaign",                         │
│          args:            { campaignId, metadataCid, ... },          │
│          gas:             30_000_000_000_000 (30 TGas),              │
│          attachedDeposit: "0"  (or price in yoctoNEAR for purchase)  │
│        }                                                              │
│                                                                       │
│  3. NEAR WALLET SIGNS                                                 │
│     └─ User approves in wallet.testnet.near.org                      │
│     └─ Private key (ed25519) signs the transaction hash              │
│     └─ Key stored in browser localStorage (BrowserLocalStorageKeyStore)│
│                                                                       │
│  4. BROADCAST TO NETWORK                                              │
│     └─ Signed tx sent to: https://rpc.testnet.near.org               │
│     └─ NEAR validators receive and execute it                        │
│                                                                       │
│  5. CONTRACT EXECUTES                                                 │
│     └─ NEAR runtime calls the method on the contract WASM            │
│     └─ State changes written to NEAR's storage trie                  │
│     └─ Events emitted via near.log()                                 │
│                                                                       │
│  6. RESULT RETURNED                                                   │
│     └─ Transaction hash returned to app                              │
│     └─ App calls /api/campaign/[id]/purchase with the tx hash        │
│     └─ Backend verifies tx on RPC before granting access             │
│                                                                       │
│  NEAR UNITS:                                                          │
│  1 NEAR = 10^24 yoctoNEAR                                            │
│  Gas: measured in TGas (10^12 gas units)                             │
│  Storage: ~1 NEAR per 100KB                                          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Deployment to NEAR Testnet

### Prerequisites

```bash
# 1. Install Node.js (v18+)
node --version   # should be v18+

# 2. Install NEAR CLI
npm install -g near-cli

# 3. Verify NEAR CLI installed
near --version
```

---

### Step 1 — Create a NEAR Testnet Account

Go to: **https://wallet.testnet.near.org**

1. Click **"Create Account"**
2. Choose a name like `privatestream.testnet`
3. Save your seed phrase securely
4. You get **200 NEAR** free testnet tokens

---

### Step 2 — Login with NEAR CLI

```bash
near login
```

This opens your browser → approve in NEAR Wallet → CLI stores your key locally.

Verify login:
```bash
near state your-account.testnet
```

---

### Step 3 — Create a Sub-Account for the Contract

Best practice: deploy contracts to a sub-account, not your main account.

```bash
# Create sub-account with 10 NEAR for storage
near create-account privatestream.your-account.testnet \
  --masterAccount your-account.testnet \
  --initialBalance 10
```

Example:
```bash
near create-account privatestream.alice.testnet \
  --masterAccount alice.testnet \
  --initialBalance 10
```

---

### Step 4 — Install near-sdk-js and Build the Contract

```bash
# In the project root
cd "d:\DONATION PLATFORMS\PrivateStreamNEAR"

# Install near-sdk-js (contract compiler)
npm install -g near-sdk-js

# Build the contract JS → WASM
npx near-sdk-js build contracts/private_stream_near.js \
  --out contracts/private_stream_near.wasm
```

This compiles the JavaScript contract to WebAssembly (WASM) — the format NEAR executes.

---

### Step 5 — Deploy the WASM to Testnet

```bash
near deploy \
  --accountId privatestream.alice.testnet \
  --wasmFile contracts/private_stream_near.wasm
```

You'll see:
```
Starting deployment. Account id: privatestream.alice.testnet, node: https://rpc.testnet.near.org
Transaction Id: <TX_HASH>
Done deploying to privatestream.alice.testnet
```

---

### Step 6 — Initialize the Contract

```bash
near call privatestream.alice.testnet init \
  '{
    "treasuryAccount": "alice.testnet",
    "nearPriceCents": 500
  }' \
  --accountId privatestream.alice.testnet
```

- `treasuryAccount` = the NEAR account that receives 10% platform fees
- `nearPriceCents` = current NEAR price in cents (500 = $5.00)

---

### Step 7 — Update .env.local

```bash
NEXT_PUBLIC_CONTRACT_NAME=privatestream.alice.testnet
PLATFORM_TREASURY_ACCOUNT=alice.testnet
```

---

### Step 8 — Test the Contract

```bash
# Check contract state
near state privatestream.alice.testnet

# Test: check if account has campaign (should return false)
near view privatestream.alice.testnet has_campaign \
  '{"accountId": "alice.testnet"}'

# Test: get stats
near view privatestream.alice.testnet get_stats '{}'
```

---

### Step 9 — Verify on NEAR Explorer

Open: **https://testnet.nearblocks.io/address/privatestream.alice.testnet**

You'll see:
- Contract deployed ✓
- All transactions
- State storage used
- Method calls

---

## Contract Methods Reference

### Change Methods (cost gas, modify state)

| Method | Args | Deposit | Description |
|--------|------|---------|-------------|
| `init` | `{treasuryAccount, nearPriceCents}` | 0 | Initialize contract (once only) |
| `create_campaign` | `{campaignId, metadataCid, priceYocto, durationSeconds}` | 0 | Create campaign (1 per account) |
| `purchase_access` | `{campaignId}` | price in yoctoNEAR | Buy access, splits payment |
| `update_near_price` | `{priceCents}` | 0 | Update NEAR/USD price |

### View Methods (free, read-only)

| Method | Args | Returns |
|--------|------|---------|
| `get_campaign` | `{campaignId}` | Campaign object |
| `get_active_campaigns` | `{fromIndex?, limit?}` | Campaign[] |
| `get_all_campaigns` | `{fromIndex?, limit?}` | Campaign[] |
| `get_creator_campaign` | `{accountId}` | Campaign or null |
| `has_campaign` | `{accountId}` | boolean |
| `get_access_expiry` | `{accountId, campaignId}` | Unix timestamp |
| `has_valid_access` | `{accountId, campaignId}` | boolean |
| `get_stats` | `{}` | Stats object |

---

## Example: Full Test Flow via CLI

```bash
# 1. Create a campaign
near call privatestream.alice.testnet create_campaign \
  '{
    "campaignId": "test-campaign-001",
    "metadataCid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    "priceYocto": "1000000000000000000000000",
    "durationSeconds": 86400
  }' \
  --accountId alice.testnet \
  --gas 30000000000000

# 2. Check campaign was created
near view privatestream.alice.testnet get_campaign \
  '{"campaignId": "test-campaign-001"}'

# 3. Purchase access (as a different account)
near call privatestream.alice.testnet purchase_access \
  '{"campaignId": "test-campaign-001"}' \
  --accountId bob.testnet \
  --deposit 1 \
  --gas 30000000000000

# 4. Check access expiry
near view privatestream.alice.testnet get_access_expiry \
  '{"accountId": "bob.testnet", "campaignId": "test-campaign-001"}'

# 5. Check if access is valid
near view privatestream.alice.testnet has_valid_access \
  '{"accountId": "bob.testnet", "campaignId": "test-campaign-001"}'
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Account not found` | Sub-account not created | Run `near create-account` first |
| `Cannot deserialize contract state` | Contract already initialized | Skip `init` call |
| `You already own an active campaign` | One-per-account rule | Expected behavior |
| `Insufficient payment` | Sent less than price | Match exact `priceYocto` |
| `Campaign is sold out` | Revenue cap reached | Expected behavior |
| `WASM file not found` | Build step skipped | Run `npx near-sdk-js build` first |

---

## Get Free Testnet NEAR

- **Faucet:** https://near-faucet.io
- **Wallet:** https://wallet.testnet.near.org (200 NEAR on signup)
- **Explorer:** https://testnet.nearblocks.io
