// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import scaffold from './scripts/scaffold-integration.ts';

// https://astro.build/config
export default defineConfig({
  // site intentionally omitted for platform deployments (set when you have a stable domain)
  integrations: [react(), scaffold()],
  output: 'static', // Changed to 'static' to support API endpoints
  adapter: node({ mode: 'standalone' }),
  vite: {
    build: {
      cssMinify: true,
      minify: 'esbuild' // Keep JS minification enabled
    }
  }
});
