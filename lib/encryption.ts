/**
 * PrivateStream NEAR - Encryption Module
 *
 * Implements AES-256-GCM symmetric encryption for campaign metadata.
 *
 * ARCHITECTURE NOTE (FHE-Inspired Design):
 * This module simulates a privacy-preserving access control layer.
 * In a production FHE system, encryption/decryption would occur inside
 * a confidential computing enclave (e.g., NEAR's future encrypted execution layer).
 * Here we approximate that model: metadata is encrypted before leaving the server,
 * stored encrypted on IPFS, and decrypted ONLY server-side after wallet ownership
 * verification — the client never sees the raw key or plaintext URL.
 *
 * Encryption: AES-256-GCM
 * Key size: 256 bits (32 bytes)
 * IV: 96 bits (12 bytes) — random per encryption
 * Auth tag: 128 bits (16 bytes)
 */

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector (random, 12 bytes) */
  iv: string;
  /** Base64-encoded GCM authentication tag (16 bytes) */
  authTag: string;
}

// ─── Key Management ───────────────────────────────────────────────────────────

/**
 * Derives a 32-byte Buffer from the ENCRYPTION_MASTER_KEY env variable.
 * Accepts either a 64-char hex string or a 32-char UTF-8 string.
 * NEVER expose this key to the client.
 */
function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    throw new Error(
      '[Encryption] ENCRYPTION_MASTER_KEY is not set. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Accept 64-char hex (preferred) or 32-char UTF-8
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  if (raw.length === 32) {
    return Buffer.from(raw, 'utf8');
  }

  // Derive a 32-byte key via SHA-256 hash of the provided string
  return crypto.createHash('sha256').update(raw).digest();
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Each call generates a fresh random IV — never reuse IVs.
 *
 * @param plaintext - The string to encrypt (e.g., a YouTube URL)
 * @returns EncryptedPayload with base64-encoded ciphertext, iv, and authTag
 */
export function encryptText(plaintext: string): EncryptedPayload {
  const key = getMasterKey();

  // Generate a cryptographically random 12-byte IV
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * This function MUST only be called server-side after access verification.
 *
 * @param payload - The EncryptedPayload to decrypt
 * @returns The original plaintext string
 * @throws If the auth tag verification fails (tampered data)
 */
export function decryptText(payload: EncryptedPayload): string {
  const key = getMasterKey();

  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypts a YouTube URL specifically for campaign metadata storage.
 * Returns the encrypted components ready to embed in the IPFS metadata JSON.
 */
export function encryptVideoUrl(youtubeUrl: string): EncryptedPayload {
  return encryptText(youtubeUrl);
}

/**
 * Decrypts a video URL from campaign metadata.
 * Only called after wallet ownership and access expiry verification.
 */
export function decryptVideoUrl(payload: EncryptedPayload): string {
  return decryptText(payload);
}

/**
 * Generates a cryptographically secure random token for play sessions.
 * Used to create short-lived, single-use play authorization tokens.
 */
export function generatePlayToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates an HMAC-SHA256 signature for a play token.
 * Used to verify token authenticity without storing tokens server-side.
 */
export function signPlayToken(token: string, accountId: string, campaignId: string): string {
  const key = getMasterKey();
  const payload = `${token}:${accountId}:${campaignId}`;
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

/**
 * Verifies a play token signature.
 */
export function verifyPlayToken(
  token: string,
  signature: string,
  accountId: string,
  campaignId: string
): boolean {
  const expected = signPlayToken(token, accountId, campaignId);
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}
