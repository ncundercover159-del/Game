import { defineConfig } from 'vite';

const SERVER = process.env.SQUISHY_SERVER || 'http://localhost:8787';

export default defineConfig({
  server: {
    host: true,
    proxy: {
      '/ws': { target: SERVER.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
