/**
 * EXIF Metadata Utilities
 * Access pre-extracted EXIF data from co-located metadata files
 */

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
 * Get EXIF metadata for an image by its path
 * @param imagePath - Path to image (e.g., "/library/originals/TheAfricanPortraits/image.jpg")
 * @returns EXIF metadata or null if not found
 */
export async function getImageMetadata(imagePath: string): Promise<ExifMetadata | null> {
  try {
    // Parse the directory structure from the path
    const pathParts = imagePath.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    // Find the directory (should be the part after 'originals')
    const originalsIndex = pathParts.indexOf('originals');
    if (originalsIndex === -1 || originalsIndex >= pathParts.length - 2) {
      return null;
    }
    
    const directory = pathParts[originalsIndex + 1];
    
    // Fetch the co-located metadata from the same directory as the images
    const metadataUrl = `/library/originals/${directory}/metadata.json`;
    const response = await fetch(metadataUrl);
    
    if (!response.ok) {
      return null;
    }
    
    const directoryMetadata = await response.json();
    return directoryMetadata[filename] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get EXIF metadata synchronously (for build-time use)
 * Note: This is not possible with the co-located approach since files are in public/
 * Use the async version instead
 */
export function getImageMetadataSync(directory: string, filename: string): ExifMetadata | null {
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
 * Get all available directories with metadata by scanning the originals directory
 * @returns Promise that resolves to array of directory names that have metadata
 */
export async function getAvailableDirectories(): Promise<string[]> {
  try {
    // This would require a server-side API to list directories
    // For now, return empty array - directories are discovered dynamically when needed
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Get debug info about the metadata system
 * @returns Debug information (limited without index file)
 */
export function getDebugInfo() {
  return {
    note: 'Metadata files are co-located with images in public/library/originals/',
    architecture: 'Co-located metadata files',
    discovery: 'Dynamic discovery based on image paths'
  };
}