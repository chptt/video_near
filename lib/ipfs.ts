/**
 * PrivateStream NEAR - Pinata IPFS Storage Module
 *
 * Handles encrypted metadata upload and retrieval via Pinata IPFS.
 * Raw YouTube URLs are NEVER stored — only AES-256-GCM encrypted payloads.
 */

import { PINATA_GATEWAY_URL, PINATA_API_URL } from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The metadata structure stored on IPFS.
 * All sensitive fields (video URL) are encrypted before storage.
 */
export interface CampaignMetadata {
  campaignId: string;
  title: string;
  description: string;
  /** AES-256-GCM encrypted YouTube URL (base64) */
  encryptedVideoUrl: string;
  /** AES-256-GCM IV (base64) */
  iv: string;
  /** AES-256-GCM auth tag (base64) */
  authTag: string;
  creatorAccount: string;
  priceNear: string;
  durationSeconds: number;
  revenueCapUsd: number;
  platformFeePercentage: number;
  createdAt: string;
  status: 'active' | 'sold_out' | 'removed';
}

export interface IPFSUploadResult {
  cid: string;
  url: string;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Uploads campaign metadata JSON to Pinata IPFS.
 * Returns the IPFS CID (Content Identifier) for on-chain storage.
 *
 * @param metadata - The campaign metadata object (with encrypted video URL)
 * @returns IPFS CID and gateway URL
 */
export async function uploadMetadataToIPFS(
  metadata: CampaignMetadata
): Promise<IPFSUploadResult> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error('[IPFS] PINATA_JWT environment variable is not set');
  }

  const body = JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: {
      name: `privatestream-campaign-${metadata.campaignId}`,
      keyvalues: {
        campaignId: metadata.campaignId,
        creator: metadata.creatorAccount,
        type: 'campaign-metadata',
      },
    },
    pinataOptions: {
      cidVersion: 1,
    },
  });

  const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`[IPFS] Pinata upload failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const cid = result.IpfsHash as string;

  return {
    cid,
    url: `${PINATA_GATEWAY_URL}/ipfs/${cid}`,
  };
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Fetches campaign metadata from IPFS by CID.
 * Tries the configured Pinata gateway (with auth) first,
 * then falls back to public IPFS gateways.
 */
export async function fetchMetadataFromIPFS(cid: string): Promise<CampaignMetadata> {
  const jwt = process.env.PINATA_JWT;
  const configuredGateway = process.env.PINATA_GATEWAY_URL || PINATA_GATEWAY_URL;

  // Build list of gateways to try in order
  const gateways: Array<{ url: string; headers: Record<string, string> }> = [
    // 1. Configured gateway with JWT auth (works for dedicated gateways)
    {
      url: `${configuredGateway}/ipfs/${cid}`,
      headers: {
        Accept: 'application/json',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
    // 2. Public Pinata gateway (no auth needed)
    {
      url: `https://gateway.pinata.cloud/ipfs/${cid}`,
      headers: { Accept: 'application/json' },
    },
    // 3. Cloudflare IPFS gateway
    {
      url: `https://cloudflare-ipfs.com/ipfs/${cid}`,
      headers: { Accept: 'application/json' },
    },
    // 4. ipfs.io gateway
    {
      url: `https://ipfs.io/ipfs/${cid}`,
      headers: { Accept: 'application/json' },
    },
  ];

  const errors: string[] = [];

  for (const { url, headers } of gateways) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        next: { revalidate: 300 },
      });

      clearTimeout(timer);

      if (!response.ok) {
        errors.push(`${url} → HTTP ${response.status}`);
        continue;
      }

      const metadata = await response.json();
      return metadata as CampaignMetadata;
    } catch (err) {
      errors.push(`${url} → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`[IPFS] All gateways failed for ${cid}: ${errors.join(' | ')}`);
}

/**
 * Updates campaign status on IPFS by uploading a new version.
 * IPFS is immutable, so "updates" create a new CID.
 * The smart contract stores the latest CID.
 *
 * @param existingCid - The current IPFS CID
 * @param updates - Partial metadata updates to apply
 * @returns New IPFS CID with updated metadata
 */
export async function updateMetadataOnIPFS(
  existingCid: string,
  updates: Partial<CampaignMetadata>
): Promise<IPFSUploadResult> {
  // Fetch existing metadata
  const existing = await fetchMetadataFromIPFS(existingCid);

  // Merge updates
  const updated: CampaignMetadata = {
    ...existing,
    ...updates,
  };

  // Upload new version
  return uploadMetadataToIPFS(updated);
}

/**
 * Unpins a CID from Pinata (optional cleanup).
 * Does not affect IPFS network availability, only Pinata pinning.
 */
export async function unpinFromIPFS(cid: string): Promise<void> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return;

  try {
    await fetch(`${PINATA_API_URL}/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });
  } catch (error) {
    console.warn(`[IPFS] Failed to unpin ${cid}:`, error);
  }
}

/**
 * Validates that a CID is a valid IPFS content identifier.
 */
export function isValidCID(cid: string): boolean {
  // CIDv0: starts with Qm, 46 chars
  // CIDv1: starts with b, variable length
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/.test(cid);
}
