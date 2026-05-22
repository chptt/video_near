/**
 * POST /api/campaign/[campaignId]/play
 *
 * Verifies wallet access on-chain and returns a decrypted embed URL.
 * Queries the NEAR contract directly — no registry dependency.
 *
 * SECURITY MODEL:
 * - Access expiry verified on-chain via get_access_expiry
 * - Video URL decrypted server-side only
 * - Raw YouTube URL never sent to client
 * - Only embed URL returned (no download possible)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccessRecord, recordPurchase } from '@/lib/campaignRegistry';
import { fetchMetadataFromIPFS } from '@/lib/ipfs';
import { decryptVideoUrl } from '@/lib/encryption';
import { issuePlayToken, formatRemainingTime } from '@/lib/access';
import { toEmbedUrl } from '@/lib/youtube';
import { isValidCampaignId, isValidNearAccountId } from '@/lib/validation';
import { CONTRACT_NAME, NEAR_NODE_URL } from '@/lib/constants';

interface RouteParams {
  params: { campaignId: string };
}

// Server-safe RPC view call
async function viewMethod<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
  const rpc = NEAR_NODE_URL || 'https://test.rpc.fastnear.com';
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 'play', method: 'query',
      params: {
        request_type: 'call_function', finality: 'final',
        account_id: CONTRACT_NAME, method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return JSON.parse(Buffer.from(data.result.result).toString()) as T;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = params;
    const body = await request.json();
    const { accountId, expiresAt: clientExpiresAt, metadataCid: clientMetadataCid } = body;

    if (!isValidCampaignId(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }
    if (!accountId || !isValidNearAccountId(accountId)) {
      return NextResponse.json({ error: 'Valid NEAR account ID required' }, { status: 401 });
    }

    // ── Resolve metadataCid ───────────────────────────────────────────────────
    // Try: client-provided (from campaign page) → contract query
    let metadataCid: string | null =
      typeof clientMetadataCid === 'string' && clientMetadataCid.length > 0
        ? clientMetadataCid
        : null;

    let campaignTitle = '';
    let campaignCreator = '';
    let campaignDuration = 86400;

    if (!metadataCid) {
      try {
        const onChain = await viewMethod<{
          metadataCid: string; creator: string;
          durationSeconds: number; id: string;
        } | null>('get_campaign', { campaignId });
        if (onChain) {
          metadataCid = onChain.metadataCid;
          campaignCreator = onChain.creator;
          campaignDuration = Number(onChain.durationSeconds);
        }
      } catch (e) {
        console.warn('[Play] Could not fetch campaign from chain:', e);
      }
    }

    if (!metadataCid) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // ── Verify access on-chain ────────────────────────────────────────────────
    // Primary: query contract directly
    // Fallback: registry record or client-provided expiresAt
    let expiryTimestamp: number | null = null;
    const now = Math.floor(Date.now() / 1000);

    try {
      const onChainExpiry = await viewMethod<number>(
        'get_access_expiry',
        { accountId, campaignId }
      );
      if (onChainExpiry && Number(onChainExpiry) > 0) {
        expiryTimestamp = Number(onChainExpiry);
      }
    } catch (e) {
      console.warn('[Play] Could not check on-chain access, using fallbacks:', e);
    }

    // Fallback 1: registry
    if (!expiryTimestamp) {
      const accessRecord = getAccessRecord(accountId, campaignId);
      if (accessRecord?.expiresAt) expiryTimestamp = accessRecord.expiresAt;
    }

    // Fallback 2: client-provided (validated)
    if (!expiryTimestamp && clientExpiresAt) {
      const maxAllowed = now + 60 * 60 * 24 * 31;
      if (typeof clientExpiresAt === 'number' && clientExpiresAt > now && clientExpiresAt <= maxAllowed) {
        expiryTimestamp = clientExpiresAt;
      }
    }

    if (!expiryTimestamp || expiryTimestamp <= now) {
      return NextResponse.json(
        { error: 'Access denied', reason: expiryTimestamp ? 'Access has expired' : 'No purchase record found', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    const remainingSeconds = expiryTimestamp - now;

    // ── Fetch + decrypt metadata from IPFS ────────────────────────────────────
    const metadata = await fetchMetadataFromIPFS(metadataCid);

    const decryptedUrl = decryptVideoUrl({
      ciphertext: metadata.encryptedVideoUrl,
      iv: metadata.iv,
      authTag: metadata.authTag,
    });

    const embedUrl = toEmbedUrl(decryptedUrl);
    if (!embedUrl) {
      return NextResponse.json({ error: 'Failed to generate player URL' }, { status: 500 });
    }

    const playToken = issuePlayToken(accountId, campaignId);

    return NextResponse.json({
      success: true,
      embedUrl,
      playToken: {
        token: playToken.token,
        signature: playToken.signature,
        expiresAt: playToken.expiresAt,
      },
      access: {
        expiresAt: expiryTimestamp,
        remainingSeconds,
        remainingFormatted: formatRemainingTime(expiryTimestamp),
      },
      campaign: {
        title: metadata.title || campaignTitle || `Campaign ${campaignId.slice(0, 8)}`,
        creatorAccount: metadata.creatorAccount || campaignCreator,
      },
    });
  } catch (error) {
    console.error('[API] Play endpoint error:', error);

    if (error instanceof Error && error.message.includes('auth tag')) {
      return NextResponse.json(
        { error: 'Metadata integrity check failed.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Failed to initialize player' }, { status: 500 });
  }
}
