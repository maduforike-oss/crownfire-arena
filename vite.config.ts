import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/crownfire-arena/' : '/',
  build: {
    chunkSizeWarningLimit: 1800
  }
});
