// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import scaffold from './scripts/scaffold-integration.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://thecont1.github.io',
  integrations: [react(), scaffold()],
  output: 'server', // Changed to 'server' to support API endpoints
  adapter: node({
    mode: 'standalone'
  })
});
