/**
 * EXIF Metadata Utilities
 * Fetch EXIF data from the hosted C2PA/EXIF API
 */
import { C2PA_API_BASE, resolveImageUri } from './api';

export interface ExifMetadata {
  filename: string;
  format: string;
  size: [number, number];
  width: number;
  height: number;
  exif: Record<string, any>;
  photography?: {
    camera_make?: string;
    camera_model?: string;
    lens_model?: string;
    aperture?: string;
    shutter_speed?: string;
    iso?: number;
    focal_length?: string;
    date_original?: string;
    date_taken?: string;
    artist?: string;
    copyright?: string;
    description?: string;
    title?: string;
  };
}

/**
 * Get EXIF metadata for an image by its path.
 * Calls the hosted EXIF API at apps.thecontrarian.in.
 * @param imagePath - Path to image (root-relative or full URL)
 * @returns EXIF metadata or null if not found
 */
export async function getImageMetadata(imagePath: string): Promise<ExifMetadata | null> {
  try {
    const uri = resolveImageUri(imagePath);
    const apiUrl = `${C2PA_API_BASE}/api/exif_metadata?uri=${encodeURIComponent(uri)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) return null;

    const data = await response.json();
    // The API returns { "filename": { ...metadata } } — extract the first (only) value
    const keys = Object.keys(data);
    if (keys.length === 0) return null;
    return data[keys[0]] as ExifMetadata;
  } catch (error) {
    return null;
  }
}

/**
 * Get EXIF metadata synchronously (for build-time use)
 * Note: This is not possible with the co-located approach since files are in public/
 * Use the async version instead
 */
export function getImageMetadataSync(_directory: string, _filename: string): ExifMetadata | null {
  return null;
}

/**
 * Get formatted camera info string
 * @param metadata - EXIF metadata object
 * @returns Formatted camera string (e.g., "FUJIFILM GFX 50S")
 */
export function getCameraInfo(metadata: ExifMetadata): string {
  if (!metadata.photography) return '';
  
  const { camera_make, camera_model } = metadata.photography;
  
  if (camera_make && camera_model) {
    return `${camera_make} ${camera_model}`;
  } else if (camera_make || camera_model) {
    return camera_make || camera_model || '';
  }
  
  return '';
}

/**
 * Get formatted camera settings string
 * @param metadata - EXIF metadata object
 * @returns Formatted settings string (e.g., "f/8 • 1/60s • ISO 400 • 85mm")
 */
export function getCameraSettings(metadata: ExifMetadata): string {
  if (!metadata.photography) return '';
  
  const { aperture, shutter_speed, iso, focal_length } = metadata.photography;
  
  const settings = [
    aperture,
    shutter_speed,
    iso ? `ISO ${iso}` : '',
    focal_length
  ].filter(Boolean);
  
  return settings.join(' • ');
}

/**
 * Get image caption from EXIF description or title
 * @param metadata - EXIF metadata object
 * @returns Caption text or empty string
 */
export function getImageCaption(metadata: ExifMetadata): string {
  if (!metadata.photography) return '';
  
  // Prefer title, fall back to description
  return metadata.photography.title || metadata.photography.description || '';
}

/**
 * Get debug info about the metadata system
 */
export function getDebugInfo() {
  return {
    note: 'EXIF and C2PA metadata served by hosted API',
    api: C2PA_API_BASE,
    architecture: 'Static site + external API for metadata extraction'
  };
}
