/**
 * POST /api/ipfs/upload
 *
 * Proxy endpoint for IPFS uploads.
 * Keeps the Pinata JWT server-side only.
 * Called internally by the campaign create flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadMetadataToIPFS, CampaignMetadata } from '@/lib/ipfs';

export async function POST(request: NextRequest) {
  try {
    const metadata: CampaignMetadata = await request.json();

    if (!metadata.campaignId || !metadata.encryptedVideoUrl) {
      return NextResponse.json(
        { error: 'Invalid metadata structure' },
        { status: 400 }
      );
    }

    const result = await uploadMetadataToIPFS(metadata);

    return NextResponse.json({
      success: true,
      cid: result.cid,
      url: result.url,
    });
  } catch (error) {
    console.error('[API] IPFS upload error:', error);
    return NextResponse.json(
      { error: 'IPFS upload failed' },
      { status: 500 }
    );
  }
}
