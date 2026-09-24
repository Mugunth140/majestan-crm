/**
 * Shared imgproxy watermarking for CRM uploads.
 *
 * Single source of truth for watermark opacity so every module stamps the
 * same faint mark. The watermark SVG itself is solid black (no built-in
 * opacity), so the URL opacity param is the only faintness control.
 *
 * NOTE: watermarking bakes into the stored file at upload time. Photos
 * processed before a change keep their old mark; only new uploads change.
 */
export const WATERMARK_OPACITY = 0.15;

const IMGPROXY_BASE =
  process.env.IMGPROXY_URL || 'http://imgproxy:8080';

export function buildWatermarkedImageUrl(
  sourceUrl: string,
  scale = 0.3,
): string {
  return (
    `${IMGPROXY_BASE}/insecure/rs:fit:1920:1080:0/q:85/` +
    `wm:${WATERMARK_OPACITY}:ce:0:0:${scale}/format:webp/plain/${sourceUrl}`
  );
}

export async function fetchWatermarkedImage(
  sourceUrl: string,
  scale = 0.3,
  timeoutMs = 15000,
): Promise<Buffer> {
  const res = await fetch(buildWatermarkedImageUrl(sourceUrl, scale), {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Imgproxy failed: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function isImageMimetype(mimetype: string | undefined): boolean {
  return (
    typeof mimetype === 'string' &&
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
      mimetype.toLowerCase(),
    )
  );
}
