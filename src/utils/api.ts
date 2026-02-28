/**
 * External API configuration
 * All C2PA and EXIF metadata requests go to the hosted verifier app.
 */
export const C2PA_API_BASE = 'https://apps.thecontrarian.in/c2pa';

const CF_IMAGE_CDN = 'https://library.thecontrarian.in';

/**
 * Build a Cloudflare Image Transformation URL.
 * Requires Image Transformations to be enabled on the library.thecontrarian.in zone.
 * Converts /library/originals/... paths into cdn-cgi/image/ URLs that serve
 * WebP/AVIF at the requested width, eliminating the multi-MB original JPEG payloads.
 */
export function cfImageUrl(src: string, width: number, quality = 85): string {
  const path = src.startsWith('/library/')
    ? src.slice('/library/'.length)
    : src.replace(/^\//, '');
  return `${CF_IMAGE_CDN}/cdn-cgi/image/width=${width},quality=${quality},format=auto/${path}`;
}

/**
 * Build the full image URI for API calls.
 * Converts root-relative paths like /library/originals/... to the CDN URL
 * that the hosted API can fetch from.
 */
export function resolveImageUri(imgPath: string): string {
  let pathname: string;
  
  try {
    // Extract pathname for both full URLs and relative paths, stripping query parameters
    pathname = new URL(imgPath, 'http://dummy.com').pathname;
  } catch {
    pathname = imgPath;
  }
  
  // Convert root-relative /library/... paths to the CDN origin
  if (pathname.startsWith('/library/')) {
    return `https://library.thecontrarian.in${pathname.replace('/library', '')}`;
  }
  
  // Fallback: assume it's a CDN-relative path
  return `https://library.thecontrarian.in/${pathname.replace(/^\//, '')}`;
}

