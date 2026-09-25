import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: './',
  publicDir: path.join(here, 'public'),
  resolve: {
    alias: {
      '@shared': path.resolve(here, '../shared'),
      '@assets': path.resolve(here, 'assets'),
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: { allow: [path.resolve(here, '..')] },
  },
  preview: { host: true, port: 4173 },
  build: {
    outDir: path.resolve(here, '../dist'),
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
