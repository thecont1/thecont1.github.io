// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://thecont1.github.io',
  integrations: [react()],
  output: 'server', // Changed to 'server' to support API endpoints
  adapter: node({
    mode: 'standalone'
  })
});
