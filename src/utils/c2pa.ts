/**
 * C2PA API utilities
 * Direct calls to hosted C2PA verification service
 */
import { C2PA_API_BASE, resolveImageUri } from './api.js';

export interface C2PAMiniData {
  status: 'verified' | 'unverified';
  creator?: string;
  issued_by?: string;
  issued_on?: string;
  digital_source_type?: string;
  more?: string;
  error?: string;
}

export interface C2PAData {
  provenance: any[];
  c2pa_data: {
    basic_info: any;
    signature_info: any;
    assertions: any[];
    ingredients: any[];
    actions: any[];
    author_info: any;
    digital_source_type: any;
  };
  thumbnails: {
    claim_thumbnail?: string;
    ingredient_thumbnail?: string;
  };
  digital_source_type: {
    code: string;
    label: string;
  };
}

/**
 * Fetch mini C2PA credentials for hover popup
 */
export async function fetchC2PAMini(imgSrc: string): Promise<C2PAMiniData> {
  try {
    const uri = resolveImageUri(imgSrc);
    const response = await fetch(`${C2PA_API_BASE}/api/c2pa_mini?uri=${encodeURIComponent(uri)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle API response format
    if (data.error === 'No Credentials Found' || data.status === 'unverified' || data.status === 'Unverified') {
      return { status: 'unverified', error: 'No credentials found' };
    }
    
    return {
      status: data.status || 'verified',
      creator: data.creator,
      issued_by: data.issued_by,
      issued_on: data.issued_on,
      digital_source_type: data.digital_source_type,
      more: data.more
    };
  } catch (error) {
    return { 
      status: 'unverified', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fetch full C2PA credentials for overlay
 */
export async function fetchC2PAData(imgSrc: string): Promise<C2PAData> {
  try {
    const uri = resolveImageUri(imgSrc);
    const response = await fetch(`${C2PA_API_BASE}/api/c2pa_metadata?uri=${encodeURIComponent(uri)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error === 'No Credentials Found' || data.error === 'no_c2pa') {
      throw new Error('No Credentials Found');
    }
    
    // Check if we have valid credential data (provenance is at top level)
    if (!data.provenance || data.provenance.length === 0) {
      throw new Error('No Credentials Found');
    }
    
    return data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch C2PA data');
  }
}

/**
 * Open C2PA overlay with full credentials
 */
export function openC2PAOverlay(imgSrc: string): void {
  // Find the C2PA overlay and trigger it directly
  const overlay = document.getElementById('c2pa-overlay') as any;
  if (overlay && overlay._manager) {
    overlay._manager.open(imgSrc);
  } else {
    console.warn('C2PA overlay not found or not initialized');
  }
}
