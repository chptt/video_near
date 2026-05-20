/**
 * PrivateStream NEAR - YouTube URL Utilities
 *
 * Handles YouTube URL parsing, validation, and embed URL generation.
 * Raw video URLs are NEVER exposed to the client — only embed URLs
 * are returned after successful access verification.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YouTubeVideoInfo {
  videoId: string;
  embedUrl: string;
  thumbnailUrl: string;
}

// ─── URL Parsing ──────────────────────────────────────────────────────────────

/**
 * Extracts the YouTube video ID from various URL formats.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/shorts/VIDEO_ID
 *
 * @param url - Any YouTube URL format
 * @returns The video ID string, or null if not a valid YouTube URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Pattern 1: youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/
  );
  if (watchMatch) return watchMatch[1];

  // Pattern 2: youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // Pattern 3: youtube.com/embed/VIDEO_ID
  const embedMatch = trimmed.match(/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // Pattern 4: youtube.com/shorts/VIDEO_ID
  const shortsMatch = trimmed.match(/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  // Pattern 5: youtube.com/v/VIDEO_ID
  const vMatch = trimmed.match(/(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];

  return null;
}

/**
 * Validates that a URL is a valid YouTube URL.
 */
export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

/**
 * Converts any YouTube URL to the standard embed URL format.
 * Embed URLs are safe to use in iframes and don't expose the original URL.
 *
 * @param url - Any YouTube URL format
 * @returns Embed URL or null if invalid
 */
export function toEmbedUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  // Build embed URL with privacy-enhanced mode and security parameters
  const params = new URLSearchParams({
    rel: '0',           // Don't show related videos
    modestbranding: '1', // Minimal YouTube branding
    playsinline: '1',   // Play inline on mobile
    enablejsapi: '1',   // Enable JS API for player control
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Gets the thumbnail URL for a YouTube video.
 * Uses the high-quality thumbnail (hqdefault).
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Parses a YouTube URL and returns full video info.
 * This is the main function to use when processing user-submitted URLs.
 *
 * @param url - Any YouTube URL format
 * @returns YouTubeVideoInfo or null if invalid
 */
export function parseYouTubeUrl(url: string): YouTubeVideoInfo | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  const embedUrl = toEmbedUrl(url);
  if (!embedUrl) return null;

  return {
    videoId,
    embedUrl,
    thumbnailUrl: getYouTubeThumbnail(videoId),
  };
}

/**
 * Normalizes a YouTube URL to the standard watch URL format.
 * Used for consistent storage before encryption.
 */
export function normalizeYouTubeUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Validates that a YouTube URL points to an unlisted or public video.
 * Note: We cannot programmatically verify "unlisted" status without YouTube API.
 * This is a format validation only.
 */
export function validateYouTubeUrlFormat(url: string): {
  valid: boolean;
  error?: string;
  videoId?: string;
} {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'YouTube URL is required' };
  }

  const videoId = extractYouTubeVideoId(url.trim());

  if (!videoId) {
    return {
      valid: false,
      error:
        'Invalid YouTube URL. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...',
    };
  }

  if (videoId.length !== 11) {
    return { valid: false, error: 'Invalid YouTube video ID length' };
  }

  return { valid: true, videoId };
}
