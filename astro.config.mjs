// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import scaffold from './scripts/scaffold-integration.ts';

// https://astro.build/config
export default defineConfig({
  // site intentionally omitted for platform deployments (set when you have a stable domain)
  integrations: [react(), scaffold()],
  output: 'static',
  vite: {
    build: {
      cssMinify: true,
      minify: 'esbuild' // Keep JS minification enabled
    }
  }
});
