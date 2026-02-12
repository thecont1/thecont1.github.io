/**
 * External API configuration
 * All C2PA and EXIF metadata requests go to the hosted verifier app.
 */
export const C2PA_API_BASE = 'https://apps.thecontrarian.in/c2pa';

/**
 * Build the full image URI for API calls.
 * Converts root-relative paths like /library/originals/... to the CDN URL
 * that the hosted API can fetch from.
 */
export function resolveImageUri(imgPath: string): string {
  // If already a full URL, return as-is
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
    return imgPath;
  }
  // Convert root-relative /library/... paths to the CDN origin
  if (imgPath.startsWith('/library/')) {
    return `https://library.thecontrarian.in${imgPath.replace('/library', '')}`;
  }
  // Fallback: assume it's a CDN-relative path
  return `https://library.thecontrarian.in/${imgPath.replace(/^\//, '')}`;
}
