// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import scaffold from './scripts/scaffold-integration.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://thecontrarian.in',
  integrations: [react(), sitemap(), scaffold()],
  output: 'static',
  build: {
    inlineStylesheets: 'auto'
  },
  vite: {
    build: {
      cssMinify: true,
      minify: 'esbuild' // Keep JS minification enabled
    }
  }
});
