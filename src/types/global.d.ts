// Global type declarations for custom window/globalThis properties

declare global {
  interface Window {
    __postMetadataCache?: Map<string, any>;
    __lightboxMetadataCache?: Map<string, any>;
    __attachLightboxListeners?: () => void;
    renderMathInElement?: (container: HTMLElement, options?: any) => void;
  }

  var __postMetadataCache: Map<string, any> | undefined;
  var __lightboxMetadataCache: Map<string, any> | undefined;
  var __attachLightboxListeners: (() => void) | undefined;
}

export {};
