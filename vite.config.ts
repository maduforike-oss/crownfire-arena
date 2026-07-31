import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/crownfire-arena/' : '/',
  build: {
    target: 'safari13',
    chunkSizeWarningLimit: 1800
  }
});
