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
  let pathname: string;
  
  // Extract pathname from full URLs or use as-is for relative paths
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
    try {
      pathname = new URL(imgPath).pathname;
    } catch {
      pathname = imgPath;
    }
  } else {
    pathname = imgPath;
  }
  
  // Convert root-relative /library/... paths to the CDN origin
  if (pathname.startsWith('/library/')) {
    return `https://library.thecontrarian.in${pathname.replace('/library', '')}`;
  }
  
  // Fallback: assume it's a CDN-relative path
  return `https://library.thecontrarian.in/${pathname.replace(/^\//, '')}`;
}
