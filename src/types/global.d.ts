// Global type declarations for custom window/globalThis properties

declare global {
  interface Window {
    __PUBLIC_R2_CDN_ORIGIN?: string;
    __postMetadataCache?: Map<string, any>;
    __lightboxMetadataCache?: Map<string, any>;
    __attachLightboxListeners?: () => void;
  }

  var __PUBLIC_R2_CDN_ORIGIN: string | undefined;
  var __postMetadataCache: Map<string, any> | undefined;
  var __lightboxMetadataCache: Map<string, any> | undefined;
  var __attachLightboxListeners: (() => void) | undefined;
}

export {};
